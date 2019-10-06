import { Button, Combobox, Pane, Heading, Text, Spinner } from "evergreen-ui";

const path_to_domain_data = require("../data/DomainScoresAndPercentilesPathogenic_8-6-19.txt");

const path_to_exon_data = require("../data/ExonScoresAndPercentilesPathogenic_8-6-19.txt");

let graph_config = {
  width: 1000,
  height: 350,
  margin: { left: 40, right: 20, top: 20, bottom: 140 }
};
graph_config.width =
  graph_config.width - graph_config.margin.left - graph_config.margin.right;
graph_config.height =
  graph_config.height - graph_config.margin.top - graph_config.margin.bottom;

export default class App extends React.Component {
  constructor(props) {
    super(props);
    this.graph_ref = React.createRef();
    this.state = {
      gene_names: false,
      selected_gene: false,
      absolute_mode: true,
      data: false,
      percentileMode: false
    };
    this.renderGraph = this.renderGraph.bind(this);
  }
  async componentDidMount() {
    let data = await d3.tsv(path_to_domain_data);
    //let data = await d3.tsv(path_to_exon_data);
    let gene_names = get_unique_gene_names(data);
    this.setState({ data, gene_names });
    console.log(data);
    let { width, height, margin } = graph_config;
    let svg = d3.select(this.graph_ref.current).append("svg");
    svg
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom);
    this.svg_g = svg
      .append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
    // setup the x-axis, but don't run it because we don't yet have a domain
    this.svg_g
      .append("g")
      .attr("id", "x_axis")
      .attr("transform", "translate(0," + height + ")")
      .attr("class", "axis axis--x");
    this.svg_g
      .append("g")
      .attr("id", "y_axis")
      .attr("transform", "translate(0," + 0 + ")")
      .attr("class", "axis axis--y");
    this.svg_g
      .append("g")
      .attr("id", "second_y_axis")
      // .attr("transform", "translate(0," + height + ")")
      .attr("class", "axis axis--y");
    ////////////////
    //tring to label
    ////////////////
    this.svg_g
      .append("text")
      .attr("class", "x label")
      //.attr("transform", "translate(" + (width / 2) + " ," + (height + margin.bottom) + ")")
      .attr("y", 0 + height + margin.bottom + 10) //margin.left)
      .attr("x", 0 + 8 * margin.left)
      .attr("text-anchor", "middle")
      .text("Position");
    //trying to label
    this.svg_g
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("dy", "1em")
      .attr("y", 0 - margin.left)
      .attr("x", 0 - height / 2)
      .style("text-anchor", "middle")
      .text("Score");
    this.svg_g
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("dy", "1em")
      .attr("y", 0 - margin.left)
      .attr("x", 0 - 1.4 * height)
      .style("text-anchor", "middle")
      .text("Pathogenic Count");
    ////////////////  ////////////////  ////////////////  ////////////////

    // XXX and just for debug / fun, select this one
    // and switch to absolute after one second
    this.onGeneSelect("SCN1A");
    setTimeout(() => {
      this.setState(
        { absolute_mode: !this.state.absolute_mode },
        this.renderGraph
      );
    }, 1000);

    // console.log(gene_names);
  }
  onGeneSelect(selected_gene) {
    // console.log(selected_gene);
    this.setState({ selected_gene }, () => this.renderGraph());
  }
  renderGraph() {
    // console.log(selected_gene);
    let { selected_gene, absolute_mode } = this.state;
    let running_x = 0;
    let selected_data = this.state.data
      .filter(x => x["Gene"] === selected_gene)
      .map(x => {
        let { Gene, Position } = x;
        let X2 = parseFloat(x["2.5%"]);
        let X9 = parseFloat(x["97.5%"]);
        let rawScore = parseFloat(x["Raw Score"]);
        let subRegion = parseFloat(x["Sub-region"]);
        let percentiles = parseFloat(x.Percentiles);
        let PathogenicCount = parseFloat(x["Pathogenic Count"]);
        let [start, end] = Position.split(":")[1]
          .split("-")
          .map(z => parseInt(z));
        // prettier-ignore
        //return { geneName, start, end, sub_region, mode, ChromAndSpan, ClinVar2Count, X9, X2 , percentiles};
        return { Gene, start, end, subRegion, rawScore, Position, PathogenicCount, X9, X2 , percentiles};
      })
      .sort((a, b) => {
        return a.start - b.start;
      })
      .map(x => {
        let len = x.end - x.start;
        x["len"] = len;
        x["running_x"] = running_x;
        running_x += len;
        return x;
      });

    let total_len = selected_data.reduce((ac, x) => ac + x.len, 0);
    // console.log(total_len);
    // hacky, only for absolute mode false
    let all_points = selected_data.map(z => [z.start, z.end]).flat();
    let all_ci = selected_data.map(z => [z.X2, z.X9]).flat();
    // console.log(selected_data);
    let points_domain = d3.extent(all_points);
    let ci_domain = d3.extent(all_ci);

    // https://bl.ocks.org/mbostock/3808221
    let { width, height, margin } = graph_config;
    let x_scale = d3.scaleLinear().range([0, width]);
    let y_scale = this.state.percentileMode
      ? d3
          .scaleLinear()
          .range([height, 0])
          .domain([0, 100])
      : d3
          .scaleLinear()
          .range([height, 0])
          .domain(ci_domain);

    let clinvar_extent = d3.extent(selected_data.map(z => z.PathogenicCount));
    clinvar_extent[0] = 0;
    // console.log(clinvar_extent);
    // let second_y_range = [graph_config.margin.bottom - 10, 25];

    let second_y_range = [height + margin.bottom - 10, height + 20];
    let second_y_scale = d3
      .scaleLinear()
      .range(second_y_range)
      // .range([graph_config.margin.bottom - 10, 25])
      .domain(clinvar_extent);

    if (absolute_mode) {
      x_scale.domain(points_domain);
    } else {
      x_scale.domain([0, total_len]);
    }

    this.svg_g
      .select("#x_axis")
      .transition()
      .call(d3.axisBottom(x_scale));
    this.svg_g
      .select("#y_axis")
      .transition()
      .call(d3.axisLeft(y_scale));

    this.svg_g
      .select("#second_y_axis")
      .transition()
      .call(d3.axisLeft(second_y_scale));

    // DATA JOIN
    // Join new data with old elements, if any.
    let spans = this.svg_g
      .selectAll(".span")
      // the function is an id function
      .data(selected_data, d => d.Position);

    // EXIT
    let spans_exit = spans.exit();

    spans_exit
      .select("rect.bar")
      .transition()
      .duration(400)
      .attr("y", 500);
    spans_exit
      .transition()
      .duration(400)
      .remove();
    // ENTER
    // Create new elements as needed.
    //
    // ENTER + UPDATE
    // After merging the entered elements with the update selection,
    // apply operations to both.
    let spans_enter = spans.enter().append("g");
    spans_enter.append("rect").attr("class", "bar");
    spans_enter.append("rect").attr("class", "mode_line");
    spans_enter.append("rect").attr("class", "pathogenic_variants");
    // enter + update
    spans = spans_enter.merge(spans).attr("class", "span");

    // console.log("x");
    // maybe need to rerender graph
    spans.on("click", d => {
      this.setState({ selected_span: d.Position }, () => this.renderGraph());
    });
    // second_y_range
    spans
      .select("rect.pathogenic_variants")
      .attr("y", d => second_y_scale(d.PathogenicCount))
      .attr("height", d => {
        let c = d.PathogenicCount;
        // prettier-ignore
        if (c === 0) { return 0 }
        return second_y_scale(c);
      })
      // .attr("stroke-width", 1)
      // .attr("stroke", "black")
      .attr(
        "fill",
        d =>
          this.state.selected_span === d.Position
            ? "rgb(150, 140, 200)"
            : "rgb(102, 179, 255)" //"rgb(130, 205, 220)"
      );
    spans
      .select("rect.bar")
      .attr("y", d => y_scale(d.X9))
      .attr("height", d => {
        return y_scale(d.X2) - y_scale(d.X9);
      })
      .attr(
        "fill",
        d =>
          this.state.selected_span === d.Position
            ? "rgb(190, 190, 250)"
            : "rgb(217, 217, 217)" //"rgb(200, 255, 200)"
      );
    // .attr("stroke-width", 1)
    // .attr("stroke", "grey");

    spans
      .select("rect.mode_line")
      // .attr("y", d => y_scale(parseFloat(d.mode)))
      .attr("y", d => {
        if (this.state.percentileMode) {
          return y_scale(parseFloat(d.percentiles));
        } else {
          return y_scale(parseFloat(d.rawScore));
        }
      })
      .attr("height", 2);

    if (absolute_mode) {
      spans
        .select("rect.bar")
        .transition()
        .attr("width", d => {
          return x_scale(d.end) - x_scale(d.start);
        })
        .attr("x", d => x_scale(d.start));

      spans
        .select("rect.mode_line")
        .transition()
        .attr("width", d => {
          return x_scale(d.end) - x_scale(d.start);
        })
        .attr("x", d => x_scale(d.start));
      spans
        .select("rect.pathogenic_variants")
        .transition()

        .attr("width", d => {
          return x_scale(d.end) - x_scale(d.start);
        })
        .attr("x", d => x_scale(d.start));
    } else {
      spans
        .select("rect.bar")
        .transition()
        .attr("width", d => {
          return x_scale(d.len);
        })
        .attr("x", d => {
          let res = d.running_x;
          return x_scale(res);
        });

      spans
        .select("rect.mode_line")
        .transition()
        .attr("width", d => {
          return x_scale(d.len);
        })
        .attr("x", d => x_scale(d.running_x));

      spans
        .select("rect.pathogenic_variants")
        .transition()
        .attr("width", d => {
          return x_scale(d.len);
        })
        .attr("x", d => x_scale(d.running_x));
    }
    if (this.state.percentileMode) {
      spans
        .select("rect.bar")
        .transition()
        .attr("height", 0);
    }
  }
  render() {
    // prettier-ignore
    let { data, gene_names, selected_gene, absolute_mode, selected_span, percentileMode } = this.state;
    if (!gene_names) {
      return LoadingPane;
    }
    return (
      <Pane>
        <Pane
          position="sticky"
          top={2}
          padding={8}
          background="white"
          //background="tint1"
          //borderBottom
          marginBottom={8}
        >
          <Pane display="flex" flexDirection="row">
            <Combobox
              items={gene_names}
              width="50%"
              onChange={selected => this.onGeneSelect(selected)}
              placeholder="Gene"
              selectedItem={selected_gene}
              openOnFocus
              autocompleteProps={{
                // Used for the title in the autocomplete.
                title: "Gene"
              }}
            />

            <Button
              appearance="primary"
              width="20%"
              intent={percentileMode ? "none" : "danger"}
              onClick={() => {
                // probs need to trigger a rerender of the graph
                this.setState({ percentileMode: !percentileMode }, () => {
                  this.renderGraph();
                });
              }}
            >
              {percentileMode ? "Plot Raw Scores" : "Plot Percentages"}
            </Button>

            <Button
              appearance="primary"
              width="20%"
              intent={absolute_mode ? "none" : "success"}
              onClick={() => {
                // probs need to trigger a rerender of the graph
                this.setState({ absolute_mode: !absolute_mode }, () => {
                  this.renderGraph();
                });
              }}
            >
              {absolute_mode ? "Remove Introns" : "Show Introns"}
            </Button>
          </Pane>

          <Pane display="flex" justifyContent="center">
            <div ref={this.graph_ref} />
          </Pane>
        </Pane>
        <Table
          data={data}
          selected_gene={selected_gene}
          selected_span={selected_span}
        />
      </Pane>
    );
  }
}

function round_helper(d) {
  let r = parseFloat(d);
  if (isNaN(r)) {
    return d;
  } else {
    return r.toFixed(3);
  }
}

let keys_to_round = ["Raw Score", "Percentiles", "2.5%", "97.5%"];
function Table(props) {
  // prettier-ignore
  if (!props.selected_gene || !props.data) {return ``}
  let keys = Object.keys(props.data[0]);
  let content = props.data
    .filter(x => x["Gene"] === props.selected_gene)
    .map((x, i) => {
      return (
        <tr
          key={i}
          className={props.selected_span === x.Position ? "selected_span" : ""}
        >
          {keys.map((z, j) => {
            return (
              <td key={j}>
                {keys_to_round.includes(z) ? round_helper(x[z]) : x[z]}
              </td>
            );
          })}
        </tr>
      );
    });
  return (
    <Pane display="flex" justifyContent="center">
      <table>
        <thead>
          <tr>
            {keys.map(k => (
              <th key={k}>{k}</th>
            ))}
          </tr>
        </thead>
        <tbody>{content}</tbody>
      </table>
    </Pane>
  );
}

function get_unique_gene_names(data) {
  let res = {};

  data.forEach(x => {
    res[x["Gene"]] = true;
  });
  return Object.keys(res);
}

let LoadingPane = (
  <Pane
    display="flex"
    alignItems="center"
    justifyContent="center"
    background="tint2"
    border="muted"
    height="100vh"
  >
    <Pane
      elevation={1}
      padding={32}
      background="white"
      display="flex"
      alignItems="center"
      justifyContent="center"
    >
      <Spinner size={16} />
      <Heading size={600} marginLeft={8}>
        Loading...
      </Heading>
    </Pane>
    <Pane />
  </Pane>
);
