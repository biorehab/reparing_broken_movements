document.addEventListener("DOMContentLoaded", function () {
    // Simulate data: A → B → C
    const N = 5000;
    const X1 = d3.range(N).map(() => d3.randomNormal(0, 3)());
    const X2 = d3.range(N).map(() => d3.randomNormal(0, 4)());
    const X3 = X1.map((x1, i) => 1.5 * x1 + 1 * X2[i] + d3.randomNormal(0, 2)());  // X3 = 3X1 + noise

    const data = X1.map((a, i) => ({ X1: a, X2: X2[i], X3: X3[i] }));

    const svg = d3.select("#BN5Demo");
    const width = +svg.attr("width");
    const height = +svg.attr("height");
    const margin = { top: 20, right: 20, bottom: 40, left: 50 };

    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const xScale = d3.scaleLinear().range([0, plotWidth]);
    const yScale = d3.scaleLinear().range([plotHeight, 0]);

    xScale.domain(d3.extent(data, d => d.X1)).nice();
    yScale.domain(d3.extent(data, d => d.X2)).nice();
    
    // Correlation coefficienty text
    const corrText = g.append("text")
      .attr("class", "corr-text")
      .attr("x", 90)
      .attr("y", 0)
      .style("font-size", "14px")
      .style("font-family", "Inter")
      .style("fill", "steelblue");

    const condCorrText = g.append("text")
      .attr("class", "cond-corr-text")
      .attr("x", 130)
      .attr("y", 0)
      .style("font-size", "14px")
      .style("font-family", "Inter")
      .style("fill", "red");

    const xAxis = g.append("g")
                   .attr("transform", `translate(0,${plotHeight})`)
                   .attr("class", "x-axis")
                   .call(d3.axisBottom(xScale))
                   .selectAll("text") // Select all tick labels
                   .style("font-size", "12px")  // Set font size
                   .style("font-family", "Inter")  // Set font type
                   .style("fill", "black");  // Set text color;
    const yAxis = g.append("g")
                   .attr("class", "y-axis")
                   .call(d3.axisLeft(yScale))
                   .selectAll("text") // Select all tick labels
                   .style("font-size", "12px")  // Set font size
                   .style("font-family", "Inter")  // Set font type
                   .style("fill", "black");  // Set text color;;
    // X-axis Label
    g.append("text")
     .attr("class", "x-axis-label")
     .attr("x", plotWidth / 2)
     .attr("y", plotHeight + margin.bottom)
     .attr("text-anchor", "middle")
     .style("font-size", "16px")
     .style("font-family", "Inter")
     .style("fill", "black")
     .text("X1");
    // Y-axis Label
    g.append("text")
     .attr("class", "x-axis-label")
     .attr("x", 0 - 1.5 * margin.left / 2)
     .attr("y", plotHeight / 2 )
     .attr("text-anchor", "middle")
     .style("font-size", "16px")
     .style("font-family", "Inter")
     .style("fill", "black")
     .text("X2");
    
    const updatePlotBN5 = () => {
      const condition = document.getElementById("conditionCheckboxBN5").checked;
      document.getElementById("bSliderBN5").disabled = !condition;
      const bTarget = parseFloat(document.getElementById("bSliderBN5").value);
      document.getElementById("bValueBN5").textContent = bTarget.toFixed(1);
      
      // Unconditioned points
      const circles_uncond = g.selectAll("circle").data(data, (d, i) => i);
      circles_uncond.enter()
        .append("circle")
        .attr("r", 2)
        .attr("fill", "steelblue")
        .attr("opacity", 0.3)
        .merge(circles_uncond)
        .attr("cx", d => xScale(d.X1))
        .attr("cy", d => yScale(d.X2));
      circles_uncond.exit().remove();

      if (condition) {
        const eps = 0.2; // bandwidth for approximate conditioning
        let filtered = data.filter(d => Math.abs(d.X3 - bTarget) < eps);
        // Conditioned points
        const circles_cond = g.selectAll("circle.cond").data(filtered, (d, i) => i);
        circles_cond.enter()
          .append("circle")
          .attr("class", "cond")
          .attr("r", 2)
          .attr("fill", "red")
          .attr("opacity", 1.0)
          .merge(circles_cond)
          .attr("cx", d => xScale(d.X1))
          .attr("cy", d => yScale(d.X2));
        // Display Pearson correlation coefficient.
        if (filtered.length > 2) {
          const condCorr = pearsonCorrelation(filtered.map(d => d.X1), filtered.map(d => d.X2));
          condCorrText.text(`${condCorr.toFixed(2)} (X3≈${bTarget.toFixed(1)})`);
        } else {
          condCorrText.text(`Err`);
        }
      } else {
        // Remove conditioned points
        g.selectAll("circle.cond").remove();
        condCorrText.text("");
      }

      // Pearson correlation for full data
      const corr = pearsonCorrelation(data.map(d => d.X1), data.map(d => d.X2));
      corrText.text(`${corr.toFixed(2)}`);
    };
    
    // Initial plot
    updatePlotBN5();

    // Event listeners
    document.getElementById("conditionCheckboxBN5").addEventListener("change", updatePlotBN5);
    document.getElementById("bSliderBN5").addEventListener("input", updatePlotBN5);
  });