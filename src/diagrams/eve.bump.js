﻿/*!
 * eve.bumpDiagram.js
 * https://github.com/eveui/eve
 *
 * Copyright 2015, Ismail Ozdemir
 * Released under the MIT license
 * https://github.com/eveui/eve/blob/master/LICENSE
 *
 * Date: 2015-04-09 09:15 AM (EST)
 *
 * DEFINITION
 * Base class for bumpDiagram diagram.
 */
(function (e) {
    //define bumpDiagram diagram class
    function bumpDiagram(options) {
        //remove legend
        if (options.legend) {
            options.legend.enabled = false;
        } else {
            options.legend = { enabled: false };
        }

        //remove stacked
        if (options.yAxis) {
            options.yAxis.stacked = false;
        } else {
            options.yAxis = { stacked: false };
        }

        //declare needed variables
        var diagram = eve.base.init(options),
            currentSerie = diagram.series[0],
            columns = [],
            sources = [],
            columnValues = [],
            minX = 0,
            maxX = 0,
            xpos = 0,
            ypos = 0,
            minMeasure = 0,
            xScale = null,
            yScaleGroup = null,
            yScaleMeasure = null,
            tickSize = 10,
            height = 0,
            width = 0,
            margin = { left: 5, top: 5, right: 5, bottom: (diagram.xAxis.labelFontSize * 2) + tickSize },
            maxTextLength = 0,
            xAxis = null,
            yAxisLeft = null,
            yAxisRight = null,
            xAxisSVG = null,
            yAxisLeftSVG = null,
            yAxisRightSVG = null,
            sourceColors = {},
            normalizedDataSet = null,
            lineF = null,
            bulletF = null,
            lineSeries = null,
            linePaths = null,
            bulletSeries = null,
            latestPositions = [],
            orderedSources = [],
            currentSource = null,
            maxMeasure = 0;

        //calculates scales and environmental variables
        function calculateScales() {
            //clear columns and sources
            columns = [];
            sources = e.getUniqueValues(diagram.data, currentSerie.sourceField);

            //set columns
            d3.keys(diagram.data[0]).map(function (d, i) {
                //check key if available
                if (d !== currentSerie.sourceField && d !== 'total') {
                    //push current key as column
                    columns.push(currentSerie.dataType === 'numeric' ? +d : new Date(d));
                }
            });

            //iterate all sources to set colors
            sources.forEach(function (s, i) {
                //set grouped color
                sourceColors[s] = i >= e.colors.length ? e.randColor() : e.colors[i];
            });

            //get min and max x value
            minX = d3.min(columns);
            maxX = d3.max(columns);
            maxTextLength = d3.max(sources, function (d) { return d.toString().length; });
            
            //calculate min measure
            columnValues = [];

            //iterate dataset to find min and max measures
            diagram.data.forEach(function (d) {
                //iterate columns to fill up the column values
                columns.forEach(function (c) {
                    //push column values
                    columnValues.push(+d[c]);
                });

                //set min and max measure
                minMeasure = d3.min(columnValues);
                maxMeasure = d3.max(columnValues);
            });

            //calculate margins
            margin.right = (((diagram.yAxis.labelFontSize / 2) * (maxTextLength + 1)) + diagram.yAxis.labelFontSize) + 5,
            margin.left = (((diagram.yAxis.labelFontSize / 2) * (diagram.formatNumber(maxMeasure, diagram.yAxis.numberFormat).toString().length + 1)) + diagram.yAxis.labelFontSize) + 5,

            //calculate dimension
            width = (diagram.plot.width - margin.right - margin.left);
            height = (diagram.plot.height - margin.bottom - margin.top);

            //create scales
            yScaleGroup = d3.scaleLinear().domain([minMeasure, maxMeasure]).range([0, height]);
            yScaleMeasure = d3.scaleLinear().domain([minMeasure, maxMeasure]).range([0, height]);
            xScale = currentSerie.dataType === 'numeric' ? d3.scaleLinear() : d3.scaleUtc();
            xScale.domain([minX, maxX]).range([0, width]).clamp(true);

            //normalize dataset
            normalizedDataSet = normalizeDataset();

            //iterate all normalized dataset records
            latestPositions = [];
            normalizedDataSet.forEach(function (d) {
                //iterate all values in current set
                d.values.forEach(function (v) {
                    //check whether the current x value matches with the max
                    if (v.xValue === maxX) {
                        //create last order
                        latestPositions.push({
                            source: d.name,
                            value: v.yValue
                        });
                    }
                });
            });

            //order by its value latest ordered sources
            latestPositions.sort(function (a, b) { return a.value - b.value; });
            
            //create ordered sources
            orderedSources = [];
            latestPositions.forEach(function (p) { orderedSources.push(p.source); });

            //create both axes
            xAxis = d3.axisBottom().scale(xScale);
            yAxisLeft = d3.axisLeft().scale(yScaleMeasure).ticks(maxMeasure);
            yAxisRight = d3.axisRight().scale(yScaleGroup).ticks(maxMeasure);
        }

        //updates axis
        function updateAxisStyle() {
            //select x axis path and change stroke
            xAxisSVG.selectAll('path')
                .style('stroke-opacity', diagram.xAxis.alpha)
                .style('stroke-width', diagram.xAxis.thickness + 'px')
                .style('stroke', diagram.xAxis.color);

            //select all lines in xaxis
            xAxisSVG.selectAll('line')
                .style('fill', 'none')
                .style('stroke-width', diagram.xAxis.thickness + 'px')
                .style('shape-rendering', 'crispEdges')
                .style('stroke-opacity', diagram.xAxis.alpha)
                .style('stroke', diagram.xAxis.color);

            //select all texts in xaxis
            xAxisSVG.selectAll('text')
                .style('fill', diagram.xAxis.labelFontColor)
                .style('font-size', diagram.xAxis.labelFontSize + 'px')
                .style('font-family', diagram.xAxis.labelFontFamily + ', Arial, Helvetica, Ubuntu')
                .style('font-style', diagram.xAxis.labelFontStyle === 'bold' ? 'normal' : diagram.xAxis.labelFontStyle)
                .style('font-weight', diagram.xAxis.labelFontStyle === 'bold' ? 'bold' : 'normal')
                .style('text-anchor', 'middle')
                .transition(diagram.animation.duration)
                .ease(diagram.animation.easing.toEasing())
                .text(function (d) { return d; });

            //select x axis path and change stroke
            yAxisLeftSVG.selectAll('path')
                .style('stroke-opacity', diagram.yAxis.alpha)
                .style('stroke-width', diagram.yAxis.thickness + 'px')
                .style('stroke', diagram.yAxis.color);

            //select all lines in yaxis
            yAxisLeftSVG.selectAll('line')
                .style('fill', 'none')
                .style('stroke-width', diagram.yAxis.thickness + 'px')
                .style('shape-rendering', 'crispEdges')
                .style('stroke-opacity', diagram.yAxis.alpha)
                .style('stroke', diagram.yAxis.color);

            //select all texts in yaxis
            yAxisLeftSVG.selectAll('text')
                .style('fill', diagram.yAxis.labelFontColor)
                .style('font-size', diagram.yAxis.labelFontSize + 'px')
                .style('font-family', diagram.yAxis.labelFontFamily + ', Arial, Helvetica, Ubuntu')
                .style('font-style', diagram.yAxis.labelFontStyle === 'bold' ? 'normal' : diagram.yAxis.labelFontStyle)
                .style('font-weight', diagram.yAxis.labelFontStyle === 'bold' ? 'bold' : 'normal')
                .transition(diagram.animation.duration)
                .ease(diagram.animation.easing.toEasing())
                .text(function (d) { return d; });

            //select x axis path and change stroke
            yAxisRightSVG.selectAll('path')
                .style('stroke-opacity', diagram.yAxis.alpha)
                .style('stroke-width', diagram.yAxis.thickness + 'px')
                .style('stroke', diagram.yAxis.color);

            //select all lines in yaxis
            yAxisRightSVG.selectAll('line')
                .style('fill', 'none')
                .style('stroke-width', diagram.yAxis.thickness + 'px')
                .style('shape-rendering', 'crispEdges')
                .style('stroke-opacity', diagram.yAxis.alpha)
                .style('stroke', diagram.yAxis.color);

            //select all texts in yaxis
            yAxisRightSVG.selectAll('text')
                .style('fill', function (d, i) {
                    //get current source
                    currentSource = orderedSources[i];

                    //check current source stability
                    if (currentSource) {
                        //return source color
                        return sourceColors[currentSource];
                    } else {
                        //source is not available
                        return '#fff';
                    }
                })
                .style('font-size', diagram.yAxis.labelFontSize + 'px')
                .style('font-family', diagram.yAxis.labelFontFamily + ', Arial, Helvetica, Ubuntu')
                .style('font-style', diagram.yAxis.labelFontStyle === 'bold' ? 'normal' : diagram.yAxis.labelFontStyle)
                .style('font-weight', diagram.yAxis.labelFontStyle === 'bold' ? 'bold' : 'normal')
                .style('cursor', 'pointer')
                .on('click', function (d, i) {
                    //get current source
                    currentSource = orderedSources[i];

                    //check whethe rthe group name is empty
                    if (currentSource) {
                        //calculate the color of the group
                        var groupIndex = sources.indexOf(currentSource),
                            labelData = latestPositions[groupIndex];

                        //check whether the data clicke
                        if (labelData.clicked) {
                            labelData.clicked = !labelData.clicked;
                        } else {
                            labelData.clicked = true;
                        }

                        //check if the data is clicked
                        if (labelData.clicked) {
                            //dimm all bump lines
                            d3.selectAll('.eve-bump-serie').style('stroke-opacity', 0.1);
                            d3.selectAll('.eve-bump-point').style('stroke-opacity', 0.1);
                            d3.selectAll('.eve-bump-point').style('fill-opacity', 0.1);
                            d3.selectAll('.eve-bump-label').style('fill-opacity', 0.1);
                            d3.selectAll('.eve-bump-serieLabel').style('fill-opacity', 0.1);

                            //light only this one
                            d3.selectAll('.eve-bump-serie-' + groupIndex).style('stroke-opacity', 0.9);
                            d3.selectAll('.eve-bump-point-' + groupIndex).style('stroke-opacity', 1);
                            d3.selectAll('.eve-bump-point-' + groupIndex).style('fill-opacity', 1);
                            d3.selectAll('.eve-bump-label-' + groupIndex).style('fill-opacity', 1);
                            d3.selectAll('.eve-bump-serieLabel-' + groupIndex).style('fill-opacity', 1);
                        } else {
                            //dimm all bump lines
                            d3.selectAll('.eve-bump-serie').style('stroke-opacity', 0.9);
                            d3.selectAll('.eve-bump-point').style('stroke-opacity', 1);
                            d3.selectAll('.eve-bump-point').style('fill-opacity', 1);
                            d3.selectAll('.eve-bump-label').style('fill-opacity', 1);
                            d3.selectAll('.eve-bump-serieLabel').style('fill-opacity', 1);
                        }
                    } else {
                        return false;
                    }
                })
                .transition(diagram.animation.duration)
                .ease(diagram.animation.easing.toEasing())
                .text(function (d, i) {
                    //get current source
                    currentSource = orderedSources[i];

                    //check current source stability
                    if (currentSource) {
                        //source is not available
                        return currentSource;
                    } else {
                        //return source color
                        return '';
                    }
                });
        }

        //initializes axes for both cases
        function createAxes() {
            //create x axis svg
            xAxisSVG = diagramG.append('g')
                .style('fill', 'none')
                .style('shape-rendering', 'crispEdges')
                .attr('transform', 'translate(' + margin.left + ',' + height + ')')
                .attr('class', 'eve-x-axis')
                .call(xAxis);

            //create y axis left svg
            yAxisLeftSVG = diagramG.append('g')
                .style('fill', 'none')
                .style('shape-rendering', 'crispEdges')
                .attr('transform', 'translate(' + margin.left + ')')
                .attr('class', 'eve-y-axis')
                .call(yAxisLeft);

            //create y axis right svg
            yAxisRightSVG = diagramG.append('g')
                .style('fill', 'none')
                .style('shape-rendering', 'crispEdges')
                .attr('transform', 'translate(' + (width + margin.left) + ')')
                .attr('class', 'eve-y-axis')
                .call(yAxisRight);

            //set axes styling
            updateAxisStyle();
        }

        //normalizes data set
        function normalizeDataset() {
            //gets data values for the given group
            function getDataValuesForSource(source) {
                //current source dataset
                var currentSourceSet = [];

                //iterate all data
                diagram.data.forEach(function (d) {
                    //declare needed variables
                    var sourceValue = d[currentSerie.sourceField];

                    //check whether the given source matches with the source
                    if (sourceValue === source) {
                        //iterate all columns
                        currentSourceSet.push(d);
                    }
                });

                //create datarow for the current source
                var currentDataSet = [];

                //iterate all columns
                columns.forEach(function (c) {
                    //get group index
                    var sourceIndex = sources.indexOf(source),
                        sourceColor = sourceColors[source],
                        xValue = currentSerie.dataType === 'numeric' ? +c : new Date(c),
                        yValue = d3.max(currentSourceSet, function (a) { return parseFloat(a[c.toString()]); });

                    //check whether the y value > 0
                    if (yValue > 0) {
                        //set curent column for the datarow
                        currentDataSet.push({
                            name: source,
                            xValue: xValue,
                            yValue: yValue,
                            index: sourceIndex,
                            color: sourceColor
                        });
                    }
                });

                //return generated datarow
                return currentDataSet;
            }

            //create diagram series set
            var dataSet = sources.map(function (name, index) {
                //set data object
                var dataObject = {
                    name: name,
                    values: getDataValuesForSource(name),
                    index: index,
                    color: sourceColors[name]
                };

                //return data object
                return dataObject;
            });

            //return generated data set
            return dataSet;
        }

        //animates diagram lines and bullets
        function animateBump() {
            //create line function
            lineF = d3.line()
                .curve(d3.curveLinear)
                .x(function (d) { return xScale(d.xValue) + margin.left; })
                .y(function (d) { return yScaleMeasure(d.yValue); });

            //animate line paths
            linePaths
                .transition(diagram.animation.duration)
                .ease(diagram.animation.easing.toEasing())
                .delay(function (d, i) { return i * diagram.animation.delay; })
                .attr('d', function (d) { return lineF(d.values); });

            //animate line paths
            bulletSeries
                .transition(diagram.animation.duration)
                .ease(diagram.animation.easing.toEasing())
                .delay(function (d, i) { return i * diagram.animation.delay; })
                .attr('transform', function (d) {
                    //calculate x and y positions
                    xpos = xScale(d.xValue) + margin.left;
                    ypos = yScaleMeasure(d.yValue);

                    //return new ntranslation
                    return 'translate(' + xpos + ',' + ypos + ')';
                });
                
        }

        //initializes diagram
        function initDiagram() {
            //create line function
            lineF = d3.line()
                .curve(d3.curveLinear)
                .x(function (d) { return xScale(d.xValue) + margin.left; })
                .y(function (d) { return height; });

            //create bullet function
            bulletF = d3.symbol()
                .type(function (d) { return currentSerie.bullet === 'none' ? d3.symbolCircle : currentSerie.bullet.toSymbol(); })
                .size(function (d) { return Math.pow(currentSerie.bulletSize, 2); });

            //create line series
            lineSeries = diagramG.selectAll('.eve-bump-series')
                .data(normalizedDataSet)
                .enter().append('g')
                .attr('class', 'eve-bump-series');

            //create line paths
            linePaths = lineSeries.append('path')
                .attr('class', function (d, i) { return 'eve-bump-serie eve-bump-serie-' + i; })
                .attr('d', function (d) { return lineF(d.values); })
                .style('fill', 'none')
                .style('stroke-opacity', 1)
                .style('stroke-width', currentSerie.bulletSize / 2)
                .style('stroke', function (d, i) { return d.color; })
                .on('click', function(d) {
                    //check whether the data clicke
                    if (d.clicked) {
                        d.clicked = !d.clicked;
                    } else {
                        d.clicked = true;   
                    }

                    //check if the data is clicked
                    if (d.clicked) {
                        //dimm all bump lines
                        d3.selectAll('.eve-bump-serie').style('stroke-opacity', 0.1);
                        d3.selectAll('.eve-bump-point').style('stroke-opacity', 0.1);
                        d3.selectAll('.eve-bump-point').style('fill-opacity', 0.1);
                        d3.selectAll('.eve-bump-label').style('fill-opacity', 0.1);
                        d3.selectAll('.eve-bump-serieLabel').style('fill-opacity', 0.1);

                        //light only this one
                        d3.selectAll('.eve-bump-serie-' + d.index).style('stroke-opacity', 0.9);
                        d3.selectAll('.eve-bump-point-' + d.index).style('stroke-opacity', 1);
                        d3.selectAll('.eve-bump-point-' + d.index).style('fill-opacity', 1);
                        d3.selectAll('.eve-bump-label-' + d.index).style('fill-opacity', 1);
                        d3.selectAll('.eve-bump-serieLabel-' + d.index).style('fill-opacity', 1);
                    } else {
                        //dimm all bump lines
                        d3.selectAll('.eve-bump-serie').style('stroke-opacity', 0.9);
                        d3.selectAll('.eve-bump-point').style('stroke-opacity', 1);
                        d3.selectAll('.eve-bump-point').style('fill-opacity', 1);
                        d3.selectAll('.eve-bump-label').style('fill-opacity', 1);
                        d3.selectAll('.eve-bump-serieLabel').style('fill-opacity', 1);
                    }
                });

            //create bullets
            bulletSeries = lineSeries.selectAll('.eve-bump-point')
                .data(function(d) { return d.values; })
                .enter().append('path')
                .attr('class', function (d, i) { return 'eve-bump-point eve-bump-point-' + d.index; })
                .attr('d', function (d) { return bulletF(d); })
                .style('cursor', 'pointer')
                .style('stroke-opacity', 1)
                .style('stroke', function (d, i) { return d.color; })
                .style('fill-opacity', 1)
                .style('fill', function (d, i) { return d.color; })
                .attr('transform', function (d) {
                    //calculate x and y positions
                    xpos = xScale(d.xValue) + margin.left;
                    ypos = height;

                    //return new ntranslation
                    return 'translate(' + xpos + ',' + ypos + ')';
                })
                .on('click', function(d) {
                    //check whether the data clicke
                    if (d.clicked) {
                        d.clicked = !d.clicked;
                    } else {
                        d.clicked = true;
                    }

                    //check if the data is clicked
                    if (d.clicked) {
                        //dimm all bump lines
                        d3.selectAll('.eve-bump-serie').style('stroke-opacity', 0.1);
                        d3.selectAll('.eve-bump-point').style('stroke-opacity', 0.1);
                        d3.selectAll('.eve-bump-point').style('fill-opacity', 0.1);
                        d3.selectAll('.eve-bump-label').style('fill-opacity', 0.1);
                        d3.selectAll('.eve-bump-serieLabel').style('fill-opacity', 0.1);

                        //light only this one
                        d3.selectAll('.eve-bump-serie-' + d.index).style('stroke-opacity', 0.9);
                        d3.selectAll('.eve-bump-point-' + d.index).style('stroke-opacity', 1);
                        d3.selectAll('.eve-bump-point-' + d.index).style('fill-opacity', 1);
                        d3.selectAll('.eve-bump-label-' + d.index).style('fill-opacity', 1);
                        d3.selectAll('.eve-bump-serieLabel-' + d.index).style('fill-opacity', 1);
                    } else {
                        //dimm all bump lines
                        d3.selectAll('.eve-bump-serie').style('stroke-opacity', 0.9);
                        d3.selectAll('.eve-bump-point').style('stroke-opacity', 1);
                        d3.selectAll('.eve-bump-point').style('fill-opacity', 1);
                        d3.selectAll('.eve-bump-label').style('fill-opacity', 1);
                        d3.selectAll('.eve-bump-serieLabel').style('fill-opacity', 1);
                    }
                })
                .on('mousemove', function (d, i) {
                    //show tooltip
                    diagram.showTooltip(diagram.getContent(d, currentSerie, diagram.tooltip.format));
                })
                .on('mouseout', function (d, i) {
                    //hide tooltip
                    diagram.hideTooltip();
                });

            //call animation
            animateBump();
        }

        //calculate scales to draw environment
        calculateScales();

        //create diagram g
        var diagramG = diagram.svg.append('g')
            .attr('transform', 'translate(' + diagram.plot.left + ',' + diagram.plot.top + ')');

        //create axes and diagrams
        createAxes();
        initDiagram();

        //update diagram
        diagram.update = function (data) {
            //set diagram data
            diagram.data = data;

            //re-calculate scales and the data
            calculateScales();

            //update x axis
            xAxisSVG
                .style('fill', 'none')
                .style('shape-rendering', 'crispEdges')
                .transition(diagram.animation.duration)
                .ease(diagram.animation.easing.toEasing())
                .call(xAxis);

            //update y axis left
            yAxisLeftSVG
                .style('fill', 'none')
                .style('shape-rendering', 'crispEdges')
                .transition(diagram.animation.duration)
                .ease(diagram.animation.easing.toEasing())
                .call(yAxisLeft);

            //update y axis right
            yAxisRightSVG
                .style('fill', 'none')
                .style('shape-rendering', 'crispEdges')
                .transition(diagram.animation.duration)
                .ease(diagram.animation.easing.toEasing())
                .call(yAxisRight);

            //update axis style with new scale
            updateAxisStyle();

            //set data of the contents
            lineSeries.data(normalizedDataSet).exit().remove();
            linePaths.data(normalizedDataSet).exit().remove();
            bulletSeries.data(function (d) { return d.values; }).exit().remove();

            //call animation
            animateBump();
        };

        //draws the diagram into a canvas
        diagram.toCanvas = function () {
            //get the diagram container
            var orgDiv = document.getElementById(diagram.container);
            /* create the promise for function response
            ** this is required for handling async canvas conversion
            */
            return new Promise(function (resolve) {
                //convert the final clone to canvas
                html2canvas(orgDiv).then(function (canvas) {
                    //return promise with canvas
                    resolve(canvas);
                });
            });
        };

        //returns the diagram image 
        diagram.toImage = function () {
            //get the diagram container
            var orgDiv = document.getElementById(diagram.container);
            /* create the promise for function response
            ** this is required for handling async canvas conversion
            */
            return new Promise(function (resolve) {
                //convert the final clone to canvas
                html2canvas(orgDiv).then(function (canvas) {
                    //return promise with canvas
                    resolve(canvas.toDataURL('image/png'));
                });
            });
        };

        //return abacus diagram
        return diagram;
    }

    //attach timeline method into the eve
    e.bump = function (options) {
        return new bumpDiagram(options);
    };
})(eve);