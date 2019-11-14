const markdown = require('markdown-it');
const hljs = require('highlight.js');
const {
  createFilter
} = require('rollup-pluginutils');
const mdUtils = require('./md');

/**
 * renderHighlight
 * @param  {string} str
 * @param  {string} lang
 */
var renderHighlight = function (str, lang) {
  if (!(lang && hljs.getLanguage(lang))) {
    return '';
  }

  return hljs.highlight(lang, str, true).value;
};

const ext = /demo.vue$/;
const opts = {
  html: true,
  highlight: renderHighlight
};
const md = markdown(opts);

md.use.apply(md, mdUtils.demoContainer);

module.exports = function (options = {}) {
  const filter = createFilter(options.include || ['**/*.vue'], options.exclude);

  return {
    name: 'demo',
    transform(code, id) {
      if (!ext.test(id) || !filter(id)) {
        return null;
      };

      const data = mdUtils.render(md, code);

      return {
        code: data,
        map: { mappings: '' }
      };
    }
  };
};
