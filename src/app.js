import { Button, Combobox, Pane, Heading, Text } from "evergreen-ui";

const path_to_domain_data = require("../data/DomainsScoresAndPercentilesPathogenic_7-3-19.txt");

let graph_config = {
  width: 1000,
  height: 200,
  margin: { left: 20, right: 20, top: 20, bottom: 20 }
};
graph_config.width =
  graph_config.width - graph_config.margin.left - graph_config.margin.right;
graph_config.height =
  graph_config.height - graph_config.margin.top - graph_config.margin.bottom;

export default class App extends React.Component {
  constructor(props) {
    super(props);
    this.graph_ref = React.createRef();
    this.state = { gene_names: false, selected_gene: false };
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

    this.onGeneSelect("A1BG");
    // console.log(gene_names);
  }
  onGeneSelect(selected_gene) {
    console.log(selected_gene);
    this.setState({ selected_gene });
    let selected_data = this.state.data
      .filter(x => x["geneName"] === selected_gene)
      .map(x => {
        let { geneName, sub_region, ChromAndSpan, mode } = x;
        let [start, end] = ChromAndSpan.split(":")[1]
          .split("-")
          .map(z => parseInt(z));
        return { geneName, start, end, sub_region, mode };
      });
    let all_points = selected_data.map(z => [z.start, z.end]).flat();
    // console.log(selected_data);
    let points_domain = d3.extent(all_points);
    // give the domain a bit of padding
    // points_domain[0] -= 250;
    // points_domain[1] += 250;
    let { width, height } = graph_config;
    let x_scale = d3
      .scaleLinear()
      .range([0, width])
      .domain(points_domain);

    this.svg_g.select("#x_axis").call(d3.axisBottom(x_scale));
    let spans = this.svg_g
      .selectAll(".span")
      .data(selected_data)
      .enter()
      .append("g")
      .attr("class", "span");

    spans
      .append("rect")
      .attr("y", height / 2)
      .attr("height", height / 2)
      // .attr("fill", "black")
      .attr("fill", "white")
      .attr("stroke-width", 1)
      .attr("stroke", "green")
      .attr("width", d => {
        // return x_scale(d.end - d.start);
        return x_scale(d.end) - x_scale(d.start);
      })
      .attr("x", d => x_scale(d.start));
  }
  render() {
    let { data, gene_names, selected_gene } = this.state;
    if (!gene_names) {
      return <Pane>Loading</Pane>;
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
          <Combobox
            items={gene_names}
            onChange={selected => this.onGeneSelect(selected)}
            placeholder="Gene"
            selectedItem={selected_gene}
            openOnFocus
            width="100%"
            autocompleteProps={{
              // Used for the title in the autocomplete.
              title: "Gene"
            }}
          />
          <Pane textAlign="center" marginY={16}>
            <Heading>{selected_gene || "(Select a Gene)"}</Heading>
          </Pane>
          <Pane display="flex" justifyContent="center">
            <div ref={this.graph_ref} />
          </Pane>
        </Pane>
        <Table data={data} selected_gene={selected_gene} />
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
        <tr key={i}>
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
