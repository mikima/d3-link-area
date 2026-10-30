import terser from "@rollup/plugin-terser";
import meta from "./package.json" with {type: "json"};

const banner = `// ${meta.name} v${meta.version} Copyright ${new Date().getFullYear()} ${meta.author}`;

const config = {
  input: "src/index.js",
  external: Object.keys(meta.dependencies || {}).filter(key => /^d3-/.test(key)),
  output: {
    file: `dist/${meta.name}.js`,
    name: "d3",
    format: "umd",
    indent: false,
    extend: true,
    banner,
    globals: Object.assign({}, ...Object.keys(meta.dependencies || {}).filter(key => /^d3-/.test(key)).map(key => ({[key]: "d3"})))
  }
};

export default [
  config,
  {
    ...config,
    output: {...config.output, file: `dist/${meta.name}.min.js`},
    plugins: [terser({output: {preamble: config.output.banner}})]
  }
];
