"use strict";
/*------------- async data fetch followed by generation of map ---------------*/
const urls=['https://cdn.freecodecamp.org/testable-projects-fcc/data/choropleth_map/counties.json','https://cdn.freecodecamp.org/testable-projects-fcc/data/choropleth_map/for_user_education.json'];

Promise.all(urls.map(url => fetch(url).then(response => response.json())))
  .then((data)=>{drawMap(...data)});

/*-------------------------------------------------------------------------
  function for drawing map based on topojson data and education levels data.
-------------------------------------------------------------------------*/
function drawMap(county, education) {
  
  /*-------------------------- setup variables --------------------------*/
  //map dimensions
  const w = 960;
  const h = 600;
  const legendCellWidth = 40;
  const legendCellHeight = 12;

  const stroke = {
    county: {width: .1, color: 'black'},
    state:  {width: .5, color: 'black'}
  };

  //percent colors
  const sat = 50;
  const totalColor = 7;
  const maxLight = 90;
  const minLight = 20;


  //parse data
  const minPercent = d3.min(education, (d) => d.bachelorsOrHigher);
  const maxPercent = d3.max(education, (d) => d.bachelorsOrHigher);
  
  const countyFeature = topojson.feature(county, county.objects.counties).features;
  const stateCollection = topojson.mesh(county, county.objects.states, function(a, b) { return a !== b; });
  
  countyFeature.forEach((d) => {
    const eduIndex = education.findIndex((e) => e.fips === d.id);
    d.properties.eduIndex = eduIndex;
    d.properties.percent = education[eduIndex].bachelorsOrHigher;
  });
  

  //setup percent colors
  const lightRange = (maxLight - minLight) / (totalColor - 1);
  
  const colorArr = [];
  for(let i = 0; i < totalColor; i++) {
    colorArr.push(
      function(light) {
        return 'hsl(120,'+sat+'%,'+light+'%)'
      }(maxLight - lightRange*i)
    );
  }
  
  //setup percent ticks
  const percentRange = (maxPercent - minPercent) / totalColor;
  const percentTicks = [];

  for(let i = 0; i <= totalColor; i++) {
    percentTicks.push(minPercent + percentRange * i);
  }
  
  //function to determine color of a percentage
  function colorSelector(percent) {
    for(let i = 1; i < totalColor; i++) {
      if(percent < percentTicks[i]) {
        return colorArr[i - 1];
      }
    }
    return colorArr[totalColor - 1];
  }
  

  /*---------------------------- create map ----------------------------*/
  map.replaceChildren();
  const svg = d3.select("#map")
                .attr("width", w)
                .attr("height", h);
  
  //draw counties, each county is given a path element to manipulate independently
  svg.selectAll("path")
    .data(countyFeature)
    .enter()
    .append("path")
    .attr("d", d3.geoPath())
    .attr("fill", (d) => colorSelector(d.properties.percent))
    .attr("stroke", stroke.county.color)
    .attr("stroke-width", stroke.county.width)
    .attr("class", "county")
    .attr("data-fips", (d) => d.id)
    .attr("data-education", (d) => d.properties.percent)
    .attr("edu-index", (d) => d.properties.eduIndex);

  //draw states, states are drawn as a single path element. Only state borders are shown with stroke
  svg.append("path")
    .datum(stateCollection)
    .attr("d", d3.geoPath())
    .attr("fill", 'none')
    .attr("stroke", stroke.state.color)
    .attr("stroke-width", stroke.state.width);
    
  //create legend
  const legendWidth = 20 + legendCellWidth * totalColor;
  const legend = d3.select("#legend")
                   .attr("width", legendWidth + 10)
                   .attr("height", legendCellHeight + 25);

  legend.selectAll("rect")
        .data(colorArr)
        .enter()
        .append("rect")
        .attr("x", (d, i) => 10 + i * legendCellWidth)
        .attr("y", 0)
        .attr("height", legendCellHeight)
        .attr("width", legendCellWidth)
        .attr("fill", (d) => d);
  
  //create legend axis
  const tScale = d3.scaleLinear()
                   .domain([minPercent, maxPercent])
                   .range([0, legendCellWidth * totalColor]);
  
  const tAxis = d3.axisBottom(tScale)
                  .tickFormat((d) => d3.format(".0f")(d) + "%")
                  .tickValues(percentTicks);
  
  legend.append("g")
        .attr("transform", "translate(10," + legendCellHeight + ")")
        .attr("id", "t-axis")
        .call(tAxis);
  
  /*-------------------------- show tooltip on hover ---------------------------*/
  function showTooltip(event) {
    
    //cursor has a tooltip if cursor hovers over a cell, determine condition validity
    const target = event.target;
    const classes = target.classList;
    const some = [].some.bind(classes);
    const hasToolTip = some(e => (e === "county")); //condition determined

    //generate tooltip if cursor has a tooltip
    if(hasToolTip) {
      
      //parse data for setting up tooltip
      const eduIndex = target.getAttribute("edu-index");
      
      const percent = target.getAttribute("data-education");
      const state = education[eduIndex].state;
      const area_name = education[eduIndex].area_name;
      
      //setup tooltip text, style, and attributes
      tooltip.innerText = area_name + ", " + state + ": " + percent + "%";
      tooltip.setAttribute("data-education", percent);
      tooltip.style.display = "block";
      
      //move tooltip to cursor and style display based on available space
      function moveTooltip(event) {

        //determine if default positioned tooltip is out of window
        const outOfWindow = (event.clientX + tooltip.clientWidth + 45) > window.innerWidth;
        
        //position tooltip accordingly based on assessed condition
        if(outOfWindow)
          tooltip.style.left = (event.pageX - 15 - tooltip.clientWidth) + "px";	//display to the left of cursor
        else
          tooltip.style.left = (event.pageX + 25) + "px";	//display to the right of cursor
          
        tooltip.style.top = event.pageY + "px";
      }
      map.onmousemove = moveTooltip;
      map.onmousemove(event);
    } else {
      tooltip.style.display="none";	//remove tooltip when cursor leave the cell
      map.onmousemove = null;
    }
  }

  function removeTooltip() {
    tooltip.style.display="none";	//remove tooltip when cursor leave the map
    map.onmousemove = null;
  }
  
  map.onmouseover = showTooltip;
  map.onmouseleave = removeTooltip;

  /*-------------------------- map controls ---------------------------*/
  const hwRatio = h / w;
  mapViewer.style.height = mapViewer.clientWidth * hwRatio + "px";

  //change map transform as window resizes causes map viewer to change in size
  window.onresize = function() {
    mapViewer.style.height = mapViewer.clientWidth * hwRatio + "px";
    mapTransform.resize();
  };

  //function used to limit values
  function limit(val, min, max) {
    if(val < min)
      return min;
    else if(val > max)
      return max;
    else
      return val;
  }

  /*--------------------------------------------------------------------
    Enables control of map by transformation.
    Translates control calls to map transformation.
  --------------------------------------------------------------------*/
  const mapTransform = {
    map: null,
    mapViewer: null,
    dim: {viewW: null, viewH: null, mapW: null, mapH: null, leftOffset: null, topOffset: null, minorDim: null},  //dimension of map
    transform: {  //transformation parameters(does pan and zoom at view center)
      s: {val: null, min: null, max: 40},	//scale
      l: {val: 0, min: 0, max: 0},	//left
      t: {val: 0, min: 0, max: 0},	//top
      rate: {zoom: 1.25, pan: 0.2},	//rate of transform(zoom: multiplier on dimension, pan: translate by a fraction of minor dimension)
      fast: 0.5	//multiplier on rate for fast control mode to adjust rate
    },
    resize: function() {  //perform necessary changes that comes with resize of the mapViewer
      //find map and mapViewer width and height
      const mapW = this.dim.mapW;
      const mapH = this.dim.mapH;
      const viewW = this.mapViewer.clientWidth;
      const viewH = this.mapViewer.clientHeight;
      this.dim.viewW = viewW;
      this.dim.viewH = viewH;

      //determine transform offset to center map
      const diffW = viewW - mapW;
      const diffH = viewH - mapH;
      this.dim.leftOffset = diffW/2;
      this.dim.topOffset = diffH/2;

      //determine min scale
      const ratioW = viewW/mapW;
      const ratioH = viewH/mapH;
      const minorDim = ratioW > ratioH ? "h" : "w";   //identify which is the smaller dimension
      this.dim.minorDim = minorDim;
      if(minorDim === "h") {
        this.transform.s.min = ratioH;
      } else {
        this.transform.s.min = ratioW;
      }

      //limit scale val if min scale increases to above current scale val
      if(this.transform.s.min > this.transform.s.val) {
        this.transform.s.val = this.transform.s.min;
      }

      //update limits and map transform in case changes are needed
      this.updateLimits();
      this.updateTransform();

    },
    updateTransform: function() { //update map transform style based on current parameters
      //centers map before applying transform by adding translate offsets
      //translate offsets are absolute and should not be scaled, but transform style scales it due to scale being written before transform. Thus, it needs to be divided by scale.
      const s = this.transform.s.val;
      const l = this.transform.l.val + this.dim.leftOffset/s;
      const t = this.transform.t.val + this.dim.topOffset/s;
      
      this.map.style.transform = 'scale('+s+')translate('+l+'px,'+t+'px)';
    },
    updateLimits: function(){ //calculate limits for pan based on zoom level, to prevent seeing blank areas post map-edge, recalculated everytime scale changes
      //assumes map is centered
      //formula, (mapW*s - viewW)/(2s)
      const s = this.transform.s.val;
      const d = 2*s;
      let w = (this.dim.mapW*s - this.dim.viewW) / d;
      let h = (this.dim.mapH*s - this.dim.viewH) / d;

      w = w>0 ? w : 0;
      h = h>0 ? h : 0;

      this.transform.l.min = -w;
      this.transform.l.max = w;
      this.transform.t.min = -h;
      this.transform.t.max = h;
  
      //make sure values are within new limits(scale changes can cause old values to be off limit)
      this.transform.l.val = limit(this.transform.l.val, this.transform.l.min, this.transform.l.max);
      this.transform.t.val = limit(this.transform.t.val, this.transform.t.min, this.transform.t.max);
    },
    control: {  //changes map transform based on desired controls
      moveLeft: function(direction, fast=false){
        const dim = this.dim.minorDim === "h" ? this.dim.viewH : this.dim.viewW;
        const rate = this.transform.rate.pan * dim * (fast ? this.transform.fast : 1);
        let val = this.transform.l.val + (direction?1:-1)*rate/this.transform.s.val;
        val = limit(val, this.transform.l.min, this.transform.l.max);
        if(this.transform.l.val !== val) {
          this.transform.l.val = val;
          if(fast === false)
            this.updateTransform();
        }
      },
      moveUp: function(direction, fast=false){
        const dim = this.dim.minorDim === "h" ? this.dim.viewH : this.dim.viewW;
        const rate = this.transform.rate.pan * dim * (fast ? this.transform.fast : 1);
        let val = this.transform.t.val + (direction?1:-1)*rate/this.transform.s.val;
        val = limit(val, this.transform.t.min, this.transform.t.max);
        if(this.transform.t.val !== val) {
          this.transform.t.val = val;
          if(fast === false)
            this.updateTransform();
        }
      },
      zoomIn: function(direction, fast=false){
        const rate = Math.pow(this.transform.rate.zoom, fast ? this.transform.fast : 1);
        let val = this.transform.s.val * (direction ? rate : 1/rate);
        val = limit(val, this.transform.s.min, this.transform.s.max);
        if(this.transform.s.val !== val) {
          this.transform.s.val = val;
          this.updateLimits();
          if(fast === false)
            this.updateTransform();
        }
      },
      reset: function(){
        this.keyControl.fastControl.clearTimeout();
        this.keyControl.fastControl.end();
        
        this.transform.s.val = this.transform.s.min;
        this.updateLimits();

        this.updateTransform();
      }
    },
    initialise: function(map, mapViewer, keyControl) { //initialise bindings and properties
      this.map = map;
      this.mapViewer = mapViewer;
      this.keyControl = keyControl;
      
      //find map and mapViewer width and height
      const mapW = map.clientWidth;
      const mapH = map.clientHeight;
      const viewW = mapViewer.clientWidth;
      const viewH = mapViewer.clientHeight;

      //initialise dimension properties
      this.dim.viewW = viewW;
      this.dim.viewH = viewH;
      this.dim.mapW = mapW;
      this.dim.mapH = mapH;
      
      //determine transform offset to center map
      const diffW = viewW - mapW;
      const diffH = viewH - mapH;
      this.dim.leftOffset = diffW/2;
      this.dim.topOffset = diffH/2;

      //determine min scale
      const ratioW = viewW/mapW;
      const ratioH = viewH/mapH;
      const minorDim = ratioW > ratioH ? "h" : "w";   //identify which is the smaller dimension
      this.dim.minorDim = minorDim;
      if(minorDim === "h") {
        this.transform.s.min = ratioH;
      } else {
        this.transform.s.min = ratioW;
      }

      //set bindings
      for(const k in this.control)
        this.control[k] = this.control[k].bind(this);

      //initialise map transformation
      this.control.reset();
    }
  };
  
  /*--------------------------------------------------------------------
    Enables control with keys, converting key presses to map controls.
    Has normal and fast mode depending on how keys are pressed.
  --------------------------------------------------------------------*/
  const keyControl = {
    mapTransform: null,
    keyList: {  //list of valid keys, their pressed(down) state, corresponding action(for controlling map)
      e: {down: false, action: function(fast){keyControl.mapTransform.control.zoomIn(true,fast)}},
      q: {down: false, action: function(fast){keyControl.mapTransform.control.zoomIn(false,fast)}},
      a: {down: false, action: function(fast){keyControl.mapTransform.control.moveLeft(true,fast)}},
      d: {down: false, action: function(fast){keyControl.mapTransform.control.moveLeft(false,fast)}},
      w: {down: false, action: function(fast){keyControl.mapTransform.control.moveUp(true,fast)}},
      s: {down: false, action: function(fast){keyControl.mapTransform.control.moveUp(false,fast)}},
      f: {down: false, action: function(fast){keyControl.mapTransform.control.reset()}}
    },
    invertZoom: function() {  //invert zoom, by switching action of keys.
      const temp = this.keyList.e.action;
      this.keyList.e.action = this.keyList.q.action;
      this.keyList.q.action = temp;
    },
    invertPan: function() {  //invert pan, by switching action of keys.
      let temp = this.keyList.d.action;
      this.keyList.d.action = this.keyList.a.action;
      this.keyList.a.action = temp;
      
      temp = this.keyList.w.action;
      this.keyList.w.action = this.keyList.s.action;
      this.keyList.s.action = temp;
    },
    findKey: function(event) {  //find key currently pressed, return null if key not valid(not in keyList)
      const key = event.key.toLowerCase();
      
      if(key in this.keyList)
        return key;
      else
        return null;
    },
    keydown: function(event) {  //handle keydown event
      const key = this.findKey(event);
      
      if(key !== null) {  //valid key, do something
        const keyObj = this.keyList[key];
        if(keyObj.down === false) { //not yet pressed, do something. Else, ignore an already pressed key
          if(this.fastControl.interval === null) { //in normal mode
            keyObj.action();  //move map
            if(this.fastControl.timeout === null)  //not yet activated timeout, activate now
              if(key !== 'f') //don't enter fast mode if it is reset key
                this.fastControl.startTimeout(); //prepare to enter fast mode, activate timeout
          }
          keyObj.down = true; //update key state
        }
      }
    },
    keyup: function(event) {  ///handle keyup event
      const key = this.findKey(event);

      if(key !== null) {  //valid key
        const keyObj = this.keyList[key];
        keyObj.down = false;  //update key state

        const noKeys = function() {  //no keys currently pressed down? true or false
          for(const key in this.keyList) {
            if(this.keyList[key].down)
              return false;
          }
          return true;
        }.call(this); 

        if(noKeys) {  //no keys pressed
          if(this.fastControl.interval !== null) //in fast mode
            this.fastControl.end();  //end fastmode, as all keys have been released
          else  //in normal mode, but preparing to enter fastmode
            this.fastControl.clearTimeout(); //cancel timer for entering fastmode, as all keys have been released
        }
      }
    },
    fastControl: {  //Enables key control to be done in fast mode, providing the required methods to keyControl
      interval: null, //repeat movement at rate specified by period
      timeout: null, //timer for running the delay
      delay: 350, //delay to start of mode when key pressed
      period: 40,	//25fps
      end: function() {
        clearInterval(this.interval);
        this.interval = null;
      },
      startTimeout: function() {
        function start() {
          function move() {
            for(const key in this.keyList) {
              if(this.keyList[key].down)
                this.keyList[key].action(true);
            }
            keyControl.mapTransform.updateTransform();
          }
          this.interval = setInterval(move.bind(keyControl), this.period);
          this.timeout = null;
        }
        this.timeout = setTimeout(start.bind(this), this.delay);
      },
      clearTimeout: function() {
        clearInterval(this.timeout);
        this.timeout = null;
      }
    },
    initialise: function(mapTransform) { //setup event listeners for keys, initialise bindings and properties
      this.mapTransform = mapTransform;
      
      this.invertPan = this.invertPan.bind(this);
      this.invertZoom = this.invertZoom.bind(this);
      this.keydown = this.keydown.bind(this);
      this.keyup = this.keyup.bind(this);
      
      document.body.onkeydown = this.keydown;
      document.body.onkeyup = this.keyup;
    }
  };

  mapTransform.initialise(map, mapViewer, keyControl);
  keyControl.initialise(mapTransform);

  //setup event listener for inverting pan and zoom.
  invertPan.onchange = keyControl.invertPan;
  invertZoom.onchange = keyControl.invertZoom;
}