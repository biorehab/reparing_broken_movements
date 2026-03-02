---
title: "Simple Recursive Least Squares"
date: "2025-03-27"
layout: "post.njk"  # Must match exactly with `post.njk`
author: "Sivakumar Balasubramanian"
tags: ["blog", "math", "estimation", "control"]
---
<link rel="stylesheet" href="{{ '/assets/css/2025-03-27-rls.css' | url }}">

<script src="https://cdnjs.cloudflare.com/ajax/libs/mathjs/11.11.1/math.min.js"></script>

<script src="{{ '/assets/js/2025-03-27-rls.js' | url }}" defer></script>

<p>I have always been interested in signal processing, control theory, and data analysis since my undergraduate days. Once I got comfortable with linear algebra, understanding ideas in these topics became easier.</p>

<p>Recently, I have been thinking about implementing assist-as-needed controllers for the different robots we are developing in my group. I wanted to see if we can have a more principled approach than our standard "+3/-1" adaptation rule. I will write about this controller at a later point. It might be worth looking at the adaptive control theory literature to see if we can find tools there we could use. This decision was further catalysed by Prof. Ahmed Chemori's talk at the INDEx workshop in Bengaluru. He had talked about $\mathcal{L}_1$ adaptive control. I've started reading their conference paper, which got me thinking about looking into the adaptive control theory to see if we can develop a general approach to assist-as-needed control of rehabilitation robots.</p>

<p>I have been reading three books: Stable Adaptive System (by Anuradha Annaswamy and Kumpati S. Naredra), Adaptive Control (by Karl Astrom and Bjorn Wittenmark), and Adaptive Control Tutorial (by Petros Loannou and Baris Fidan). Karl Astrom's book chapter on model estimation was fun to read and helped me refresh some ideas I had read a long time back. I thought I would quickly write about the simple recursive least squares idea.</p>

<p>Consider the following problem of a system that is linear in its unknown parameters:</p>

<p>$$ y = \mathbf{x}^\top \pmb{\theta} $$</p>

<p>$\mathbf{x}$ is an n-vector input that we know exactly, $y$ is the scalar output, and $\pmb{\theta}$ is the vector of unknown parameters. We are interested in determining the values of these unknown parameters for this system.<p>

<p>If we make a bunch of measurements from this system, $\left( y_i, \mathbf{x}_i \right)$ with $1 \leq i \leq m$ and $m > n$, we can then express the relationship between the measurements and the unknown parameters as the following,</p>

<p>$$ \mathbf{y}_m = 
\mathbf{X}_m \pmb{\theta} = \begin{bmatrix} \mathbf{x}_1^\top \\ \mathbf{x}_2^\top \\ \vdots \\ \mathbf{x}_m^\top \end{bmatrix}\pmb{\theta} $$</p>

<p>The subscript $m$ indicates that these variables are constructed using $m$ measurements.</p>

<p>We can solve this by minimising the least squared error between the measurements and the model predictions as the following,</p>

<p>$$ \text{minimize} \quad \Vert \mathbf{y}_m - \mathbf{X}_m\pmb{\theta} \Vert_2^2$$</p>

<p>The solution to this is given by the following (with the assumption that assuming. $\mathbf{X}_m^\top\mathbf{X}_m$),</p>

<p>$$ \hat{\pmb{\theta}}_m = \left( \mathbf{X}_m^\top\mathbf{X}_m  \right)^{-1}\mathbf{X}_m^\top\mathbf{y}_m \tag{1}$$</p>

<h2 class="post-subtitle">What if we have a new measurement?</h2>
<p> The parameter estimated above was based on $m$ measurements, let's refer to it as $\hat{\boldsymbol{\theta}}_m$. What if we have a new measurement? How can we incorporate the new measurement to obtain a new estimate $\hat{\pmb{\theta}}_{m+1}$? It turns out we do not need to redo the who procedure like in Eq. (1).</p>

<p>$$ \hat{\pmb{\theta}}_{m+1} = \left( \mathbf{X}_{m+1}^\top\mathbf{X}_{m+1}  \right)^{-1}\mathbf{X}_{m+1}^\top\mathbf{y}_{m+1} $$</p>

<p> Solving the problem requires us to invert an $n \times n$ matrix each time a new observation is available, and we essentially redo the entire problem from scratch, discarding the prior information available about the parameters in $\hat{\pmb{\theta}}_m$ from the past $m$ measurements.</p>

<p>However, it turns out that an elegant way to solve this problem is through a recursive approach. Let $\mathbf{P}_m^{-1} = \mathbf{X}_m^\top \mathbf{X}_m$, then we have</p>

<p> $$ \mathbf{P}_{m+1}^{-1} = \mathbf{X}_{m+1}^\top \mathbf{X}_{m+1} = \begin{bmatrix} \mathbf{X}_m^\top & \mathbf{x}_{m+1}\end{bmatrix} \begin{bmatrix} \mathbf{X}_m \\ \mathbf{x}_{m+1}^\top \end{bmatrix} = \mathbf{P}_{m}^{-1} + \mathbf{x}_{m+1}\mathbf{x}_{m+1}^\top$$ </p>

<p>$$ \implies \mathbf{P}_m^{-1} = \mathbf{P}_{m+1}^{-1} - \mathbf{x}_{m+1} \mathbf{x}_{m+1}^\top\tag{2}$$</p>

<p>$$ \mathbf{X}_{m+1}^\top \mathbf{y}_{m+1} = \mathbf{X}_m^\top \mathbf{y}_m + \mathbf{x}_{m+1} y_{m+1} \tag{3}$$</p>

<p>$$ \mathbf{P}_m^{-1} \hat{\pmb{\theta}}_m = \mathbf{X}_m^\top \mathbf{y}_m \tag{4}$$</p>

<p>Thus,</p>
<p>$$ \begin{split}
\hat{\pmb{\theta}}_{m+1} & = \mathbf{P}_{m+1}\left( \mathbf{X}_m^\top \mathbf{y}_m + \mathbf{x}_{m+1} y_{m+1} \right) = \mathbf{P}_{m+1}\left( \mathbf{P}_m^{-1}\hat{\pmb{\theta}}_m + \mathbf{x}_{m+1} y_{m+1} \right)\\
& = \mathbf{P}_{m+1}\left( \left(\mathbf{P}_{m+1}^{-1} - \mathbf{x}_{m+1} \mathbf{x}_{m+1}^\top \right)\hat{\pmb{\theta}}_m + \mathbf{x}_{m+1} y_{m+1} \right)\\
& = \hat{\pmb{\theta}}_m + \mathbf{P}_{m+1}\mathbf{x}_{m+1}\left( y_{m+1} - \mathbf{x}_{m+1}^\top \hat{\pmb{\theta}}_m \right)
\end{split} \tag{5}$$</p>

<p>Well, it looks like we still need to invert an $n \times n$ matrix , i.e., $\mathbf{P}_{m+1}^{-1}$. This is where the incredible **Sherman–Morrison–Woodbury formula** comes to the rescue,</p>

<p>$$ \left(\mathbf{A} + \mathbf{B}\mathbf{C}\mathbf{D}\right)^{-1} = \mathbf{A}^{-1} - \mathbf{A}^{-1}\mathbf{B}\left(\mathbf{C}^{-1} + \mathbf{D}\mathbf{A}^{-1}\mathbf{B} \right)^{-1}\mathbf{D}\mathbf{A}^{-1}$$</p>

<p>Letting, $\mathbf{A} = \mathbf{P}_m^{-1}$, $\mathbf{B} = \mathbf{x}_{m+1}$, $\mathbf{C} = \mathbf{I}_1$, and $\mathbf{D} = \mathbf{x}_{m+1}^\top$, we have<p>

<p>$$ \mathbf{P}_{m+1} = \mathbf{P}_m - \mathbf{P}_m\mathbf{x}_{m+1}\left( \mathbf{I}_1 + \mathbf{x}_{m+1}^\top\mathbf{P}_m\mathbf{x}_{m+1}\right)^{-1}\mathbf{x}_{m+1}^\top\mathbf{P}_m \tag{6}$$</p>

<p>Substituting Eq. (6) into Eq. (5), we get the following recursive relationships,</p>

<p>$$ \hat{\pmb{\theta}}_{m+1} = \hat{\pmb{\theta}}_m + \mathbf{K}_{m+1}\left( y_{m+1} - \mathbf{x}_{m+1}^\top \hat{\pmb{\theta}}_m \right) \tag{7a}$$</p>

<p>$$ \mathbf{K}_{m+1} = \mathbf{P}_m\mathbf{x}_{m+1}\left( \mathbf{I}_1 + \mathbf{x}_{m+1}^\top\mathbf{P}_m\mathbf{x}_{m+1} \right)^{-1} \tag{7b}$$</p>

<p>$$ \mathbf{P}_{m+1} = \left(\mathbf{I}_n - \mathbf{K}_{m+1}\mathbf{x}_{m+1}^\top\right)\mathbf{P}_m \tag{7c}$$</p>

<p>Eq. 7a has a beautiful interpretation: the new parameter estimate $\hat{\pmb{\theta}}_{m+1}$  can be obtained from the previous estimate $\hat{\pmb{\theta}}_m$ by correcting it by $\mathbf{K}_{m+1}\left(y_{m+1} - \mathbf{x}_{m+1}^\top \hat{\pmb{\theta}}_m\right)$. $\left(y_{m+1} - \mathbf{x}_{m+1}^\top \hat{\pmb{\theta}}_m\right)$ is the error in predicting the $(m+1)^{th}$ measurement using the parameter estimate from $m$ measurements, and the gain $\mathbf{K}_{m+1}$ how much of this error will be used to adjust the new parameter estimates? The gain $\mathbf{K}_{m+1}$ can be called the Kalman gain if we think of the system $y = \mathbf{x}^\top\pmb{\theta}$ as a linear dynamical system with the following state equations ($\pmb{\theta}_m$ is the state, and $\mathbf{x}_m$ is the input),</p>

<p>$$ \begin{split}
\pmb{\theta}_{m+1} &= \pmb{\theta}_m \\
y_{m} &= \pmb{\theta}_m^\top \mathbf{x}_m
\end{split}$$</p>

<p>This is a beautiful result!</p>

Here is an interactive demo fitting a cubic polynomial from noisy samples. The following demo shows the true polynomial in red, the estimated polynomial using the full least squares (LS) fit in a thick violet line, and the recurrsive least squares (RLS) fit in a blue line. See what happens when you keep adding more points. Do you think the LS fit and RLS fit will ways match? Check your answer using the demo, and explain.

<div id="rls-demo">
    <svg width="600" height="400" id="rls-plot"></svg>
    <div id="rls-controls">
        <button id="reset">Reset Simulation</button>
        <button id="add-data">Add Data Point</button>
    </div>
</div>

<p>That's all for now. But this is the first of many posts on recurrsive least squares filters.</p>


