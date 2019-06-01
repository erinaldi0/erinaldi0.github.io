var ogma = new Ogma({
  container: 'graph-container',
  options: {
    backgroundColor: null
  },
  debug: true
});

ogma.createClass('sourceNode');

// Create a class for 1st step neighbors
ogma.createClass('neighbor1', {
  nodeAttributes: {
    color: 'red',
    //radius: 7,
    icon: {
      color: 'white',
      content: "1",
    }
  },
  edgeAttributes: {
    color: 'red'
  }
});

// Create a class for 1st step neighbors
ogma.createClass('neighbor2', {
  nodeAttributes: {
    color: 'orange',
    //radius: 7,
    icon: {
      color: 'white',
      content: "2",
    }
  },
  edgeAttributes: {
    color: 'orange'
  }
});

ogma.events.onDoubleClick(function (ref) {
  if (!ref.target || !ref.target.isNode) return;

  var node = ref.target;

  node.addClass('sourceNode');

  node.getAdjacentNodes().addClass('neighbor1');
  node.getAdjacentEdges().addClass('neighbor1');

  node.getAdjacentNodes().getAdjacentNodes().filter(function (n) { return n !== node && !n.hasClass("neighbor1"); }).addClass('neighbor2');
  node.getAdjacentNodes().getAdjacentEdges().addClass('neighbor2');

});

ogma.events.onClick(function (ref) {
  if (!ref.target || !ref.target.isNode) return;

  var node = ref.target;

  node.removeClass('sourceNode');

  ogma.getNodesByClassName('neighbor1').removeClass('neighbor1');
  ogma.getEdgesByClassName('neighbor1').removeClass('neighbor1');

  ogma.getNodesByClassName('neighbor2').removeClass('neighbor2');
  ogma.getEdgesByClassName('neighbor2').removeClass('neighbor2');

});


// node types
var PEOPLE = 'people';

// edge types
var CALL_TO = 'call_to';

var ANIMATION_DURATION = 150;

var appState = {
  edgeGrouping: undefined,
  selectedPorts: {},
  timeFilter: [-Infinity, Infinity]
};

// transformations
var transformations = {
  edgeGrouping: null,
  portFilter: null,
  timeFilter: null
};

function initTransformations() {
  transformations.nodeFilter = ogma.transformations.addNodeFilter({
    criteria: function (node) {
      if (node.getData('type') === PEOPLE) {
        var listEdges = node.getAdjacentEdges();
        var toShow = listEdges.filter((edge) => {
          if (edge.getData('type') === CALL_TO) {
            var date = edge.getData('date') || appState.timeFilter[0];
            return (appState.timeFilter[0] <= date && date <= appState.timeFilter[1]);
          } else return false
        });
        return toShow.size > 0
      } else {
        return true;
      }
    },
    enabled: true
  });

  // order matters, this has to go before the edge grouping
  transformations.timeFilter = ogma.transformations.addEdgeFilter({
    criteria: function (edge) {
      if (edge.getData('type') === CALL_TO) {
        var date = edge.getData('date') || appState.timeFilter[0];
        return (appState.timeFilter[0] <= date && date <= appState.timeFilter[1]);
      }
      return true;
    }
  });

  // Edge grouping policy:
  //
  // group all edges between
  transformations.edgeGrouping = ogma.transformations.addEdgeGrouping({
    selector: function (edge) {
      return !edge.isExcluded() && edge.getData('type') === CALL_TO;
    },
    groupIdFunction: function (e) {
      return e.getData('source_phone') + '|' + e.getData('target_phone');
    },
    generator: function (edges) {
      var e = edges.get(0);
      var source_phone = e.getData('source_phone');
      var target_phone = e.getData('target_phone');

      return {
        data: {
          type: CALL_TO,
          group_size: edges.size,
          source_phone,
          target_phone
        }
      };
    },
    enabled: appState.edgeGrouping
  });
}

function layout() {
  ogma.layouts.force({
    charge: 10,
    radiusRatio: 2,
    gravity:0.2,
    onEnd: () =>
      ogma.view.locateGraph({
        duration: 700,
        padding: {
          bottom: 200
        }
      })
  })
}

// Style the graph based on the properties of nodes and edges
function addStyles() {

  // node styles
  ogma.styles.addNodeRule(function (n) {
    return n.getData('type') === PEOPLE;
  }, function (node) {
    var inSize = node.getAdjacentEdges({
      direction: 'in'
    }).reduce((a, b) => {
      return a + (b.getData("group_size") > 0 ? b.getData("group_size") : 1)
    }, 0) || 1;

    var outSize = node.getAdjacentEdges({
      direction: 'out'
    }).reduce((a, b) => {
      return a + (b.getData("group_size") > 0 ? b.getData("group_size") : 1)
    }, 0) || 1;

    var baseValue = 60;
    var color = new RGBColour(
      (outSize + baseValue) * 255 / 100,
      220,
      (inSize + baseValue) * 255 / 100,
    ).getCSSHexadecimalRGB();

    var toReturn = {
      color,
      radius: 5 + Math.sqrt(inSize + outSize),
      icon: {
        font: 'FontAwesome',
        content: '\uF007',
        color: '#ffffff',
        scale: 0.4
      },
      text: {
        content: "ID: " + node.getId()
      },
      badges: {
        topRight: {
          text: {
            content: outSize+inSize,
            scale: 0.2
          },
          stroke: {
            width: 1
          }
        },
      }
    }
    return toReturn;
  });

  ogma.styles.addEdgeRule({
    color: (function (edge) {
      return edge.getData('type') === CALL_TO ? '#404050' : '#405040';
    }),
    width: function (edge) {
      return 2 + Math.sqrt(edge.getData('group_size'));
    },
    shape: 'arrow',
    text: {
      content: function (edge) {
        if (edge.getData('type') === CALL_TO) {
          var groupSize = edge.getData('group_size');
          return "N. Chiamate " + (isNaN(groupSize) ? '1' : groupSize);
        }
      }
    }
  });
}


function updateState() {
  // port filters
  var ports = document.querySelectorAll('#ports input');
  Array.prototype.forEach.call(ports, function (portInput) {
    var port = portInput.getAttribute('data-port-id');
    appState.selectedPorts[port] = portInput.checked;
  });


  // edge grouping
  appState.edgeGrouping = document.getElementById('group-edges').checked;

  // time filter
  var promise = appState.edgeGrouping ?
    transformations.edgeGrouping.enable(ANIMATION_DURATION) :
    transformations.edgeGrouping.disable(ANIMATION_DURATION);

  return promise
    //.then(function () { return transformations.portFilter.refresh(ANIMATION_DURATION); })
    .then(function () {
      return ogma.transformations.afterNextUpdate();
    });
}


function initUI(graph) {
  //createPortSelector();
  appState.timeFilter = ogma.getEdges()
    .filter(function (edge) {
      return edge.getData('type') === CALL_TO;
    })
    .getData('date').reduce(function (acc, date) {
      acc[0] = Math.min(acc[0], date);
      acc[1] = Math.max(acc[1], date);
      return acc;
    }, [Infinity, -Infinity]);
  new TimeFilter(document.getElementById('timeline'), function () {
    if (transformations.timeFilter) {
      transformations.timeFilter.refresh();
    }
  }).update();
  document.getElementById('group-edges').addEventListener('change', updateState);

}

function createPortSelector(graph) {
  var portValues = {};
  appState.selectedPorts = {};
  ogma.getNodes()
    .filter(function (node) {
      return node.getData('type') === PORT;
    })
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

loadAndParseTSV('https://docs.google.com/spreadsheets/d/1aTkIAtCi0AnYM8V-27Hffynd5av_BqQ-fSPQzRonndw/pub?output=tsv')
  .then(function (records) {
    return recordsToGraph(records.data);
  })
  .then(function (graph) {
    return ogma.setGraph(graph);
  })
  .then(function (graph) {
    return initUI(graph);
  })
  .then(initTransformations)
  //.then(function () { return updateState(); })
  .then(function () {
    return addStyles();
  })
  .then(initUI)
  .then(function () {
    return layout();
  })
  .then(function () {
    return ogma.view.locateGraph({
      padding: 20
    });
  });

function recordsToGraph(records) {
  //skip header
  records = records.slice(1);
  var peoplesMap = {};

  var nodes = [],
    edges = [];

  records.forEach(function (record) {
    var id = record[0];
    var source = record[1];
    var source_phone = record[2];
    var target = record[3];
    var target_phone = record[4];
    var data = record[5]; //08/11/2003
    var ora = record[6]; //00:00:00
    var durata = record[7]; //00:00:00
    var luogo = record[8];
    var contenuto = record[9];

    var date = data.split("/");
    var time = ora.split(":");

    var timestamp = toTimestamp(date[2], date[1], date[0], time[0], time[1], time[2]);

    if (timestamp > 0) {
      // People Source node
      var peopleId = source;
      var people = peoplesMap[peopleId];
      if (!people) {
        people = peoplesMap[peopleId] = {
          id: peopleId,
          data: {
            source_phone,
            type: PEOPLE
          }
        };
        nodes.push(people);
      }

      // People Target node
      var peopleId = target;
      var people = peoplesMap[peopleId];
      if (!people) {
        people = peoplesMap[peopleId] = {
          id: peopleId,
          data: {
            target_phone,
            type: PEOPLE
          }
        };
        nodes.push(people);
      }

      // Call edge
      var call = {
        id, //: callId,
        source,
        target,
        data: {
          type: CALL_TO,
          date: timestamp,
          durata: durationToSeconds(durata),
          luogo,
          //contenuto
        }
      };
      edges.push(call);
    }
  });
  return {
    nodes: nodes,
    edges: edges
  }
}

// load data
function loadAndParseTSV(url) {
  return new Promise(function (complete, error) {
    Papa.parse(url, {
      download: true,
      complete: complete,
      error: error
    });
  });
}

function toTimestamp(year, month, day, hour, minute, second) {
  var date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  return date.getTime();
}

function calcDuration(hour, minute, second) {
  var calc = parseInt(hour) * 3600 + parseInt(minute) * 60 + parseInt(second)
  if (isNaN(calc)) return 1
  return calc
}

function durationToSeconds(duration) {
  if (!duration)
    return 1;
  var dur = duration.split(":");
  return calcDuration(dur[0], dur[1], dur[2]);
}