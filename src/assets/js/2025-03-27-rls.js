
// Data realted variables.
const xLims = [-5, 5];
const yLims = [-50, 50];
const noise = d3.randomNormal(0, 5);

// SVG plotting related variables.
const svg = d3.select("svg");
const width = +svg.attr("width");
const height = +svg.attr("height");
margin = { top: 20, right: 20, bottom: 20, left: 20 };
// margin = { top: 0, right: 0, bottom: 0, left: 0 };
const plotWidth = width - margin.left - margin.right;
const plotHeight = height - margin.top - margin.bottom;
const xPolyPointsDisp = d3.range(xLims[0], xLims[1], 0.01);
let yTruePolyPoints = null;

// Define the clip path for the SVG plot.
svg.append("defs")
   .append("clipPath")
   .attr("id", "plot-clip")
   .append("rect")
   .attr("x", margin.left)
   .attr("y", margin.top)
   .attr("width", plotWidth - margin.left)
   .attr("height", plotHeight - margin.top);

// Group
const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

// Scales
const xScale = d3.scaleLinear()
                 .domain(xLims)
                 .range([margin.left, plotWidth]); // Adjusts dynamically
const yScale = d3.scaleLinear()
                 .domain(yLims)
                 .range([plotHeight, margin.top]); // Adjusts dynamically

// X Axis
g.append("g")
 .attr("transform", `translate(0, ${yScale(0)})`) // Place x-axis at bottom
 .attr("class", "x-axis")
 .call(d3.axisBottom(xScale).tickFormat(d => (d === 0 ? "" : d))) // Hide 0 label
 .selectAll("text") // Select all tick labels
 .style("font-size", "8px")  // Set font size
 .style("font-family", "Inter")  // Set font type
 .style("fill", "gray");  // Set text color to light gray

// Set axis line and ticks to light gray
g.selectAll(".x-axis path, .x-axis line")
 .style("stroke", "gray");

// Y Axis
g.append("g")
 .attr("transform", `translate(${xScale(0)}, 0)`)
 .attr("class", "y-axis")
 .call(d3.axisLeft(yScale).tickFormat(d => (d === 0 ? "" : d))) // Hide 0 label
 .call(d3.axisLeft(yScale)) // Hide 0 label
 .selectAll("text") // Select all tick labels
 .style("font-size", "8px")  // Set font size
 .style("font-family", "Inter")  // Set font type
 .style("fill", "gray");  // Set text color to light gray

// Set axis line and ticks to light gray
g.selectAll(".y-axis path, .y-axis line")
 .style("stroke", "gray");
 
// Path for the estimated polynomial
const estLSPolyPath = g.append("path")
                       .attr("fill", "none")
                       .attr("stroke", "violet")
                       .attr("stroke-width", 6)
                       .attr("stroke-opacity", 0.6); // Set opacity for the estimated polynomial

// Path for the estimated polynomial
const estRLSPolyPath = g.append("path")
                        .attr("fill", "none")
                        .attr("stroke", "blue")
                        .attr("stroke-width", 2);
 
// Path for the true polynomial
const truePolyPath = g.append("path")
                      .attr("fill", "none")
                      .attr("stroke", "red")
                      .attr("stroke-width", 2)
                      .attr("stroke-opacity", 1);

// Legend
const legend = g.append("g")
                .attr("transform", `translate(20, 10)`); // Position legend

// Define legend items
const legendItems = [
    { label: "True", color: "red", strokeWidth: 2, opacity: 1 },
    { label: "RLS", color: "blue", strokeWidth: 2, opacity: 1 },
    { label: "LS", color: "violet", strokeWidth: 6, opacity: 0.6 }
];

// Create a group for each legend item
const legendGroups = legend.selectAll(".legend-item")
                           .data(legendItems)
                           .enter()
                           .append("g")
                           .attr("class", "legend-item")
                           .attr("transform", (d, i) => `translate(${i * 80}, 0)`); // Space out items

// Add colored legend lines
legendGroups.append("line")
            .attr("x1", 0)
            .attr("y1", 5)
            .attr("x2", 30)
            .attr("y2", 5)
            .attr("stroke", d => d.color)
            .attr("stroke-width", d => d.strokeWidth)
            .attr("stroke-opacity", d => d.opacity);

// Add text labels
legendGroups.append("text")
            .attr("x", 40)
            .attr("y", 10)
            .style("font-size", "14px")
            .style("font-family", "Inter")  // Set font type
            .text(d => d.label);

function randomPolynomial() {
    return [Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1];
}

function generatePoints(n) {
    const _xrange = xLims[1] - xLims[0];

    // Generate n random x values
    const xs = Array.from({ length: n }, () => Math.random() * _xrange + xLims[0]);
    
    // Loop over xs to compute corresponding y values
    xs.forEach(x => {
        const y = trueTheta[3] + trueTheta[2] * x + trueTheta[1] * x**2 + trueTheta[0] * x**3 + noise();
        
        // Store in respective arrays
        data.push({ x, y });
        X.push([x**3, x**2, x, 1]);
        Y.push(y);
    });
}

// Function to Draw Scatter Plot
function drawScatterPlot() {
    // Bind data to circles
    const dots = g.selectAll("circle").data(data);

    // Enter new elements
    dots.enter()
        .append("circle")
        .attr("cx", d => xScale(d.x))
        .attr("cy", d => yScale(d.y))
        .attr("r", 4)
        .style("fill", "steelblue")
        .style("opacity", 0.7)  // Set opacity here
        .merge(dots) // Update existing elements
        .transition().duration(500)
        .attr("cx", d => xScale(d.x))
        .attr("cy", d => yScale(d.y));

    // Remove old elements
    dots.exit().remove();
}

function fitLS(X, Y) {
    let XTX = math.multiply(math.transpose(X), X);
    let XTY = math.multiply(math.transpose(X), Y);
    return math.lusolve(XTX, XTY).map(v => v[0]);
}

function fitRLS(xnew, ynew, POld, thetaOld) {
    // Convert x to a column vector
    const _x = math.reshape(math.matrix(xnew), [xnew.length, 1]);
    const _thetaold = math.reshape(math.matrix(thetaOld), [thetaOld.length, 1]);
    
    // Compute the Kalman gain
    const _k1 = math.multiply(POld, _x);
    const _k2 = 1 / (1 + math.multiply(math.multiply(math.transpose(_x), POld), _x).get([0 ,0]));
    const K = math.multiply(_k1, _k2);

    // Update the parameter estimate
    const _err = ynew - math.multiply(math.transpose(_x), _thetaold).get([0, 0]);
    const _theta = math.add(_thetaold, math.multiply(K, _err));

    // Update the covariance matrix
    PNew = math.subtract(POld, math.multiply(math.multiply(K, math.transpose(_x)), POld));

    return {
        theta: math.flatten(_theta).toArray(),
        P: PNew
    };
}

function generatePolyPoints(theta) {
    return xPolyPointsDisp.map(x => theta[3] + theta[2] * x + theta[1] * x**2 + theta[0] * x**3);
}

function drawTruePolynomial() {
    // Get the y values for the true polynomial
    yTruePolyPoints = generatePolyPoints(trueTheta);
    
    // Update the true polynomial path
    truePolyPath.datum(d3.zip(xPolyPointsDisp, yTruePolyPoints))
                .attr("d", d3.line().x(d => xScale(d[0])).y(d => yScale(d[1])));
    
    // Apply the clip path to the polynomial paths
    truePolyPath.attr("clip-path", "url(#plot-clip)");
}

function drawEstimatedPolynomial() {
    // LS polynomial
    // Get the y values for the true polynomial
    let yPolyPoints = generatePolyPoints(estThetaLS);
    
    // Update the true polynomial path
    estLSPolyPath.datum(d3.zip(xPolyPointsDisp, yPolyPoints))
                 .attr("d", d3.line().x(d => xScale(d[0])).y(d => yScale(d[1])));
    
    // Apply the clip path to the polynomial paths
    estLSPolyPath.attr("clip-path", "url(#plot-clip)");

    // RLS polynomial
    // Get the y values for the true polynomial
    yPolyPoints = generatePolyPoints(estThetaRLS);
    
    // Update the true polynomial path
    estRLSPolyPath.datum(d3.zip(xPolyPointsDisp, yPolyPoints))
                  .attr("d", d3.line().x(d => xScale(d[0])).y(d => yScale(d[1])));
    
    // Apply the clip path to the polynomial paths
    estRLSPolyPath.attr("clip-path", "url(#plot-clip)");
}

// Initialize the data and the model.
let data = [];
let X = [], Y = [];
// Estimated polynomial coefficients
let estThetaLS = [0, 0, 0, 0];
let estThetaRLS = [0, 0, 0, 0];
// Recursive least squares variables.
let P = math.identity(4);

// True polynomial coefficients
let trueTheta = randomPolynomial();

// Generate the initial random points to start with.
generatePoints(5);

// Fit the initial model to the data.
estThetaLS = fitLS(X, Y);

// Fit the initial model using RLS to the data.
// Go through each of the 5 points and perform RLS
X.forEach((x, i) => {
    const update = fitRLS(x, Y[i], P, estThetaRLS);
    estThetaRLS = update.theta;
    P = update.P;
});

// Draw the data points.
drawScatterPlot();

// Draw the true polynomial
drawTruePolynomial();

// Draw the estimated polynomial.
drawEstimatedPolynomial();

// Reset button callback
document.getElementById("reset").addEventListener("click", () => {
    data = [];
    X = [];
    Y = [];
    estThetaRLS = [0, 0, 0, 0];
    P = math.identity(4);
    trueTheta = randomPolynomial();
    generatePoints(5);
    estThetaLS = fitLS(X, Y);
    drawScatterPlot();
    drawTruePolynomial();
    X.forEach((x, i) => {
        const update = fitRLS(x, Y[i], P, estThetaRLS);
        estThetaRLS = update.theta;
        P = update.P;
    });
    drawEstimatedPolynomial();
});

// Add new data cutton callback
document.getElementById("add-data").addEventListener("click", () => {
    generatePoints(1);
    estThetaLS = fitLS(X, Y);
    drawScatterPlot();
    const update = fitRLS(X[X.length - 1], Y[Y.length - 1], P, estThetaRLS);
    estThetaRLS = update.theta;
    P = update.P;
    drawEstimatedPolynomial();
});
