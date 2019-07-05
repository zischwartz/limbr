import { Button, Combobox, Pane, Heading, Text, Spinner } from "evergreen-ui";

const path_to_domain_data = require("../data/DomainsScoresAndPercentilesPathogenic_7-3-19.txt");

let graph_config = {
  width: 1000,
  height: 300,
  margin: { left: 40, right: 20, top: 20, bottom: 20 }
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
      absolute_mode: true
    };
  }
  async componentDidMount() {
    let data = await d3.tsv(path_to_domain_data);
    let gene_names = get_unique_gene_names(data);
    this.setState({ data, gene_names });

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

    // XXX and just for debug
    // this.onGeneSelect("A1BG");
    this.onGeneSelect("SCN1A");
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
      .filter(x => x["geneName"] === selected_gene)
      .map(x => {
        let { geneName, sub_region, ChromAndSpan, mode } = x;
        let X2 = parseFloat(x["X2.5."]);
        let X9 = parseFloat(x["X97.5."]);
        let [start, end] = ChromAndSpan.split(":")[1]
          .split("-")
          .map(z => parseInt(z));
        return { geneName, start, end, sub_region, mode, ChromAndSpan, X9, X2 };
      })
      .sort((a, b) => {
        return a.start - b.start;
      })
      .map(x => {
        let len = x.end - x.start;
        //   console.log(len);
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
    let { width, height } = graph_config;
    let x_scale = d3.scaleLinear().range([0, width]);
    let y_scale = d3
      .scaleLinear()
      .range([height, 0])
      .domain(ci_domain);

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
    // DATA JOIN
    // Join new data with old elements, if any.
    let spans = this.svg_g
      .selectAll(".span")
      .data(selected_data, d => d.ChromAndSpan);

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
    // enter + update
    spans = spans_enter.merge(spans).attr("class", "span");

    // console.log("x");
    // maybe need to rerender graph
    spans.on("click", d => {
      this.setState({ selected_span: d.ChromAndSpan }, () =>
        this.renderGraph()
      );
    });

    spans
      .select("rect.bar")
      .attr("y", d => y_scale(d.X9))
      // .attr("height", 10)
      .attr("height", d => {
        return y_scale(d.X2) - y_scale(d.X9);
      })
      // .attr("height", d => y_scale(d.X9) - y_scale(d.X2))
      // .attr("y", height / 2)
      // .attr("height", height / 2)
      .attr("fill", d =>
        this.state.selected_span === d.ChromAndSpan
          ? "rgb(190, 190, 250)"
          : "rgb(200, 255, 200)"
      )
      // .attr("fill", "rgb(200, 255, 200)")
      .attr("stroke-width", 1)
      .attr("stroke", "green");

    spans
      .select("rect.mode_line")
      .attr("y", d => y_scale(parseFloat(d.mode)))
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
    }
  }
  render() {
    // prettier-ignore
    let { data, gene_names, selected_gene, absolute_mode, selected_span } = this.state;
    if (!gene_names) {
      return LoadingPane;
    }
    return (
      <Pane>
        <Pane
          position="sticky"
          top={2}
          padding={8}
          background="tint1"
          borderBottom
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
              intent={absolute_mode ? "none" : "success"}
              onClick={() => {
                // probs need to trigger a rerender of the graph
                this.setState({ absolute_mode: !absolute_mode }, () => {
                  this.renderGraph();
                });
              }}
            >
              {absolute_mode ? "Absolute Mode" : "Show Introns"}
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

let keys_to_round = ["mode", "percentiles", "X2.5.", "X97.5."];
function Table(props) {
  // prettier-ignore
  if (!props.selected_gene || !props.data) {return ``}
  let keys = Object.keys(props.data[0]);
  let content = props.data
    .filter(x => x["geneName"] === props.selected_gene)
    .map((x, i) => {
      return (
        <tr
          key={i}
          className={
            props.selected_span === x.ChromAndSpan ? "selected_span" : ""
          }
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
    res[x["geneName"]] = true;
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
