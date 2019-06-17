// d3-based simple timline UI

const MS_IN_HOUR = 1000 * 1000 * 60 * 60;
const MINUTE_LIMIT = 1000 * 60
const YEAR_LIMIT = 3.154e+10
var TIMING_RANGE = MS_IN_HOUR

function getSize(container) {
  var width = container.offsetWidth - 40;
  var height = container.offsetHeight - 50;
  var height2 = container.offsetHeight - 100;
  return {
    width: width,
    height: height,
    height2
  };
}

var TimeFilter = function TimeFilter(container, update) {
  var self = this;

  var id = 'time-filter';
  this._container = document.getElementById(id) || document.createElement('div');
  this._container.id = id;

  this._update = update;

  window.addEventListener('resize', function () {
    return self._updateSize();
  });
  container.appendChild(this._container);
};


TimeFilter.prototype._updateSize = function _updateSize() {
  var ref = getSize(this._container);
  var width = ref.width;
  var height = ref.height;
  d3.select('svg').attr('width', width).attr('height', height);
};


TimeFilter.prototype.init = function init() {
  var self = this;
  this._container.innerHTML = "<svg></svg>";
  var ref = getSize(this._container);
  var width = ref.width;
  var height = ref.height;
  var height2 = ref.height2;
  var buckets = self._buckets;
  self._reduce = true

  var margin = {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0
  };

  var min = buckets[0].start;
  var max = buckets[buckets.length - 1].end;

  var minValue = 0;
  var maxValue = buckets.reduce(function (a, b) {
    return Math.max(a, b.value);
  }, 0) + 15
  var maxDurata = buckets.reduce(function (a, b) {
    return Math.max(a, b.durata);
  }, 0);


  var x = d3.scaleTime().range([0, width]),
    x2 = d3.scaleTime().range([0, width]),
    y = d3.scaleLinear().range([height, 0]),
    y2 = d3.scaleLinear().range([height2, 0]);

  x.domain([min, max]);
  y.domain([0, maxValue]);
  x2.domain(x.domain());
  y2.domain(y.domain());


  var xAxis = d3.axisBottom(x).tickSize(0),
    xAxis2 = d3.axisBottom(x2).tickSize(0),
    yAxis = d3.axisLeft(y).tickSize(0);

  var brush = d3.brushX()
    .extent([
      [0, 0],
      [width, height2]
    ])
    .on('brush', brushed);

  var zoom = d3.zoom()
    .scaleExtent([-Infinity, Infinity])
    .translateExtent([
      [0, 0],
      [width, height]
    ])
    .extent([
      [0, 0],
      [width, height]
    ])
    .on("zoom", zoomed);

  var svg = d3.select('svg');
  var g = svg.append('g').attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');
  svg.attr('width', width).attr('height', height + 80);

  svg.append("defs").append("clipPath")
    .attr("id", "clip")
    .append("rect")
    .attr("width", width)
    .attr("height", height);

  var focus = svg.append("g")
    .attr("class", "focus")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  var context = svg.append("g")
    .attr("class", "context")
    .attr("transform", "translate(" + margin.left + "," + margin.top + 120 + ")");

  var num_messages = function (dataArray, domainRange) {
    return d3.sum(dataArray, function (d) {
      return d.start >= domainRange.domain()[0] && d.start <= domainRange.domain()[1];
    })
  }

  // append scatter plot to main chart area
  var topLayer = focus.append("g");
  topLayer.attr("clip-path", "url(#clip)");
  topLayer.selectAll("message")
    .data(buckets)
    .enter().append("circle")
    .attr('class', 'message')
    .attr("r", 4)
    .style("opacity", function (d) {
      return 0.4 + d.durata / maxDurata;
    })
    .attr("cx", function (d) {
      return x(d.start);
    })
    .attr("cy", function (d) {
      return y(d.value);
    });

  focus.append("g")
    .attr("class", "axis x-axis")
    .attr("transform", "translate(0," + height + ")")
    .call(xAxis);

  focus.append("g")
    .attr("class", "axis axis--y")
    .call(yAxis);

  // Summary Stats
  focus.append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", 0 - margin.left)
    .attr("x", 0 - (height / 2))
    .attr("dy", "1em")
    .style("text-anchor", "middle")
    .text("Intercettazioni");

  focus.append("text")
    .attr("x", width - margin.right)
    .attr("dy", "1em")
    .attr("text-anchor", "end")
    .text("Totale: " + num_messages(buckets, x));

  focus.append("text")
    .attr("x", width - margin.right)
    .attr("y", 20)
    .attr("dy", "1em")
    .attr("text-anchor", "end")
    .text("Timing Range: " + millisecondsToStr(TIMING_RANGE));

  svg.append("rect")
    .attr("class", "zoom")
    .attr("width", width)
    .attr("height", height)
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")")
    .call(zoom);

  // append scatter plot to brush chart area
  var bottomLayer = context.append("g");
  bottomLayer.attr("clip-path", "url(#clip)");
  bottomLayer.selectAll("message")
    .data(buckets)
    .enter().append("circle")
    .attr('class', 'messageContext')
    .attr("r", 3)
    .style("opacity", function (d) {
      return 0.4 + d.durata / maxDurata;
    })
    .attr("cx", function (d) {
      return x2(d.start);
    })
    .attr("cy", function (d) {
      return y2(d.value);
    })

  context.append("g")
    .attr("class", "axis x-axis")
    .attr("transform", "translate(0," + height2 + ")")
    .call(xAxis);

  context.append("g")
    .attr("class", "brush")
    .call(brush)
    .call(brush.move, x.range());

  function updateSelected(extent) {
    var start = Infinity,
      end = -Infinity;
    focus.selectAll(".message")
      .attr("cx", function (d) {
        var inside = extent[0].getTime() <= d.start && d.start <= extent[1].getTime();

        if (inside) {
          start = Math.min(start, extent[0].getTime());
          end = Math.max(end, extent[1].getTime());
        }
        return x(d.start);
      })
      .attr("cy", function (d) {
        return y(d.value);
      })
    appState.timeFilter = [start, end];
    self._update();
  }

  function brushed() {
    if (d3.event.sourceEvent && d3.event.sourceEvent.type === "zoom") return; // ignore brush-by-zoom
    var s = d3.event.selection || x2.range();
    var extent = d3.event.selection.map(x2.invert, x2);
    x.domain(s.map(x2.invert, x2));

    updateSelected(extent);

    focus.select(".x-axis").call(xAxis);
    svg.select(".zoom").call(zoom.transform, d3.zoomIdentity
      .scale(width / (s[1] - s[0]))
      .translate(-s[0], 0));

  }

  function zoomed() {
    if (d3.event.sourceEvent && d3.event.sourceEvent.type === "brush") return; // ignore zoom-by-brush
    var t = d3.event.transform;
    var a, b = t.rescaleX(x2).domain()
    x.domain(b || x2.range());
    //x.domain(t.rescaleX(x2).domain());

    //GESTIONE DELLA GRANULOSITA' CTRL+SCROLL
    if (d3.event.sourceEvent.type !== "mousemove" && d3.event.sourceEvent.ctrlKey) {
      var scroll = d3.event.sourceEvent.deltaY
      if (self._reduce) {
        setTimeout(() => {
          if (!self._reduce) {
            TIMING_RANGE = scroll > 1 ? TIMING_RANGE * 1.5 : TIMING_RANGE / 1.5
            if (TIMING_RANGE > MINUTE_LIMIT && TIMING_RANGE < YEAR_LIMIT)
              self.update()
            
            self._reduce = true
          }
        }, 100);
        self._reduce = false
      }
    } else {
      updateSelected(b)

      focus.select(".x-axis")
        .call(xAxis);
      context.select(".brush")
        .call(brush.move, x.range().map(t.invertX, t))
    }
  }

  brush.extent([0,0])

};

TimeFilter.prototype.bucketCreator = function bucketCreator() {
  var edges = ogma.getEdges('raw')
    .filter(function (edge) {
      return edge.getData('type') === CALL_TO;
    })
    .getData()
    .sort(function (e1, e2) {
      return e1.date - e2.date;
    });

  var start = edges[0].date;
  var next = start + TIMING_RANGE;
  var durata = edges[0].durata;
  var value = 0;

  var buckets = [{
    start: edges[0].date - TIMING_RANGE,
    end: edges[0].date,
    durata: 0,
    value: 0
  }];
  edges.forEach(function (e, i) {
    if (e.date >= next) {
      // store
      var toInsert = {
        start: e.date,
        end: e.date + TIMING_RANGE,
        durata: durata,
        value: value
      }
      buckets.push(toInsert);
      // reset
      start = toInsert.start;
      durata = 0;
      value = 0;
    }
    next = start + TIMING_RANGE;
    durata += e.durata
    value += 1;
  });

  buckets.push({
    start: next,
    end: next + TIMING_RANGE,
    durata: 0,
    value: 0
  });
  this._buckets = buckets;
}

TimeFilter.prototype.update = function update() {
  this.bucketCreator();
  this.init();
};

function createTimingSelector() {
  var timingValues = {};
  appState.selectedTiming = TIMING_RANGE;
  ogma.getNodes()
    .filter(function (node) { return node.getData('type') === PORT; })
    .forEach(function (node) {
      var ref = node.getData();
      var port = ref.port;
      portValues[port] = portValues[port] || [];
      portValues[port].push(node.getId());
      appState.selectedPorts[port] = true;
    });

  var container = document.getElementById('ports');
  appState.ports = portValues;
  container.innerHTML = Object.keys(portValues)
    .sort(function (a, b) {
      return portValues[b].length - portValues[a].length;
    })
    .map(function (port) {
      return "<input type=\"checkbox\" data-port-id=\"" + port + "\" " +
        "checked id=\"port-" + port + "\" name=\"port-" + port + "\">" +
        "<label for=\"port-" + port + "\" title=\"" + (portValues[port].length) +
        " connections\"> " + port + "</label>";
    }).join('');
}

function millisecondsToStr(milliseconds) {

  function numberEnding (number) {
      return (number > 1) ? 'i' : 'o';
  }
  function hourEnding (number) {
    return (number > 1) ? 'e' : 'a';
}

  var temp = Math.floor(milliseconds / 1000);
  var years = Math.floor(temp / 31536000);
  if (years) {
      return years + ' ann' + numberEnding(years);
  }
  var days = Math.floor((temp %= 31536000) / 86400);
  if (days) {
      return days + ' giorn' + numberEnding(days);
  }
  var hours = Math.floor((temp %= 86400) / 3600);
  if (hours) {
      return hours + ' or' + hourEnding(hours);
  }
  var minutes = Math.floor((temp %= 3600) / 60);
  if (minutes) {
      return minutes + ' minut' + numberEnding(minutes);
  }
  var seconds = temp % 60;
  if (seconds) {
      return seconds + ' second' + numberEnding(seconds);
  }
  return 'meno di un secondo';
}