// Generative model for BN6
function BN6GenModel(N) {
    // Simulate the model.
    const X1 = d3.range(N).map(() => d3.randomNormal(0, 3)());
    const X2 = X1.map(x1 => 2 * x1 + d3.randomNormal(0, 1)());
    const X3 = X1.map(x1 => -0.025 * Math.pow(x1, 2) - x1 + d3.randomNormal(0, 2)());
    const X4 = X2.map((x2, i) => 0.5 * x2 - 0.5 * X3[i] + d3.randomNormal(0, 2)());
    const X5 = X4.map(x4 => 4 * Math.pow(x4, 1) + d3.randomNormal(0, 2)());
    return [
        ["X1", "X2", "X3", "X4", "X5"],
        X1.map((x1, i) => ({ X1: x1, X2: X2[i], X3: X3[i], X4: X4[i], X5: X5[i] }))
    ];
}

// Read the conditioned variable status and values.
function ReadConditionedMap(varNames) {
    return Object.fromEntries(
        varNames.map(name => {
            const checked = document.getElementById(`conditionCheckboxBN6${name}`).checked;
            const value = checked ? parseFloat(document.getElementById(`bSliderBN6${name}`).value) : null;
            return [name, value];
        })
    );
}

// Filter the data based on the conditioning variable.
function FilterData(data, conditionedValues, eps) {
    return Object.entries(conditionedValues).reduce((filtered, [key, val]) => {
        return val == null ? filtered : filtered.filter(d => Math.abs(d[key] - val) < eps);
    }, data);
}

document.addEventListener("DOMContentLoaded", function () {
    const N = 7500;
    const [variables, data] = BN6GenModel(N);

    const svg = d3.select("#BN6Demo");
    const width = +svg.attr("width");
    const height = +svg.attr("height");
    const size = 190;
    const padding = 20;
    const n = variables.length;

    const xScales = {};
    const yScales = {};

    variables.forEach(v => {
        const extent = d3.extent(data, d => d[v]);
        xScales[v] = d3.scaleLinear()
            .domain(extent).nice()
            .range([padding / 2, size - padding / 2]);

        yScales[v] = d3.scaleLinear()
            .domain(extent).nice()
            .range([size - padding / 2, padding / 2]); // flipped for SVG
    });

    const g = svg.append("g").attr("transform", `translate(40,40)`);

    // Plot all points once.
    // Create grid of scatterplot cells once
    for (let i = 1; i < n; i++) {
        const yi = variables[i];
        const yAxis = d3.axisLeft(yScales[yi]).ticks(4);
        
        for (let j = 0; j < i; j++) {
            const xj = variables[j];
            const xAxis = d3.axisBottom(xScales[xj]).ticks(4);
            const cell = g.append("g")
                          .attr("class", `cell cell-${i}-${j}`)
                          .attr("data-x", xj)
                          .attr("data-y", yi)
                          .attr("transform", `translate(${j * size}, ${(i - 1) * size - 2 * padding})`);

            // Axes
            if (i === n - 1) {
                cell.append("g")
                    .attr("transform", `translate(0, ${size - padding / 2})`)
                    .call(xAxis)
                    .selectAll("text").style("font-size", "10px");

                g.append("text")
                 .attr("x", (j + 0.5) * size)
                 .attr("y", 4 * size - 1 * padding)
                 .attr("text-anchor", "middle")
                 .style("font-size", "16px")
                 .style("font-family", "Inter")
                 .style("fill", "black")
                 .text(xj);
            }

            if (j === 0) {
                cell.append("g")
                    .attr("transform", `translate(${padding / 2}, 0)`)
                    .call(yAxis)
                    .selectAll("text").style("font-size", "10px");

                g.append("text")
                    .attr("x", -30)
                    .attr("y", (i - 0.75) * size)
                    .attr("text-anchor", "middle")
                    .style("font-size", "16px")
                    .style("font-family", "Inter")
                    .style("fill", "black")
                    .text(yi);
            }

            // Draw base (unfiltered) points
            cell.selectAll(".point-all")
                .data(data)
                .enter()
                .append("circle")
                .attr("class", "point-all")
                .attr("cx", d => xScales[xj](d[xj]))
                .attr("cy", d => yScales[yi](d[yi]))
                .attr("r", 1.5)
                .attr("fill", "steelblue")
                .attr("opacity", 0.1);
            
            // Display the correlation coefficient
            if (i !== j) {
                const allX = data.map(d => d[xj]);
                const allY = data.map(d => d[yi]);
                const corrAll = pearsonCorrelation(allX, allY);
                cell.selectAll(".all-corr-label").remove();
                cell.append("text")
                    .attr("class", "all-corr-label")
                    .attr("x", 20)
                    .attr("y", 10)
                    .attr("text-anchor", "start")
                    .style("font-size", "12px")
                    .style("fill", "steelblue")
                    .text(`r=${corrAll.toFixed(2)}`);
            }
        }
    }

    // Plot filtered data
    const updatePlotBN6 = () => {
        const conditionedValues = ReadConditionedMap(variables);
        const eps = 0.2;
        // Disable all sliders that are not checked
        variables.forEach(v => {
            const checkbox = document.getElementById(`conditionCheckboxBN6${v}`).checked;
            console.log(`Checkbox ${v} is ${checkbox}`);
            const slider = document.getElementById(`bSliderBN6${v}`);
            const bTarget = parseFloat(slider.value);
            slider.disabled = !checkbox;
            document.getElementById(`bValueBN6${v}`).textContent = checkbox ? bTarget.toFixed(1) : "";
        });
        
        // If all checkboxes are unchecked, remove all filtered points
        // We need to update only if any of the checkboxes are checked
        const anyChecked = Object.values(conditionedValues).some(val => val != null);
        if (!anyChecked) {
            // If no checkboxes are checked, remove all filtered points
            g.selectAll(".point-filtered").remove();
            g.selectAll(".cond-corr-label").remove();
            return;
        }
        // Filter data
        const filteredData = FilterData(data, conditionedValues, eps);

        // For each scatter cell, update the red filtered points
        g.selectAll(".cell").each(function () {
            const cell = d3.select(this);
            const xi = cell.attr("data-x");
            const yj = cell.attr("data-y");

            // Remove old filtered points
            cell.selectAll(".point-filtered").remove();

            // Add new ones
            cell.selectAll(".point-filtered")
                .data(filteredData)
                .enter()
                .append("circle")
                .attr("class", "point-filtered")
                .attr("cx", d => xScales[xi](d[xi]))
                .attr("cy", d => yScales[yj](d[yj]))
                .attr("r", 1.5)
                .attr("fill", "red")
                .attr("opacity", 0.6);
            
            // Display the correlation coefficient
            const filteredX = filteredData.map(d => d[xi]);
            const filteredY = filteredData.map(d => d[yj]);
            // Correlation coefficients
            const corrFiltered = pearsonCorrelation(filteredX, filteredY);
            cell.selectAll(".cond-corr-label").remove();
            // Draw text for filtered (red) points only if we have any
            if ((filteredX.length > 1) && (xi !== yj)) {
                cell.append("text")
                    .attr("class", "cond-corr-label")
                    .attr("x", 80)
                    .attr("y", 10)
                    .attr("text-anchor", "start")
                    .style("font-size", "12px")
                    .style("fill", "red")
                    .text(`r=${corrFiltered.toFixed(2)}`);
            }
        });
    };

    // Initial draw
    updatePlotBN6();

    // Add even listeners.
    variables.forEach(v => {
        const checkbox = document.getElementById(`conditionCheckboxBN6${v}`);
        const slider = document.getElementById(`bSliderBN6${v}`);
        checkbox.addEventListener("change", updatePlotBN6);
        slider.addEventListener("input", updatePlotBN6);
    });
});