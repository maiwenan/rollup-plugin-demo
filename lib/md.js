const md = require('markdown-it')();
const cheerio = require('cheerio');
const striptags = require('./striptags');

/**
 * `<pre></pre>` => `<pre v-pre></pre>`
 * `<code></code>` => `<code v-pre></code>`
 * @param  {string} code
 * @return {string}
 */
function addVuePreviewAttr(code) {
  return code.replace(/(<pre|<code)/g, '$1 v-pre');
}

function renderVueTemplate(html, wrapper) {
  const $ = cheerio.load(html, {
    decodeEntities: false,
    lowerCaseAttributeNames: false,
    lowerCaseTags: false
  });
  const output = {
    style: $.html('style'),
    // get only the first script child. Causes issues if multiple script files in page.
    script: $.html($('script').first())
  };
  let result;

  $('style').remove();
  $('script').remove();

  result =
    `<template><${wrapper} class="elf-lib-demo">` +
    $.html() +
    `</${wrapper}></template>\n` +
    output.style +
    '\n' +
    output.script;

  return result;
}

function convert(str) {
  str = str.replace(/(&#x)(\w{4});/gi, function ($0) {
    return String.fromCharCode(
      parseInt(
        encodeURIComponent($0).replace(/(%26%23x)(\w{4})(%3B)/g, '$2'),
        16
      )
    );
  });
  return str;
}

function wrap(render) {
  return function () {
    return render
      .apply(this, arguments)
      .replace('<code class="', '<code class="hljs ')
      .replace('<code>', '<code class="hljs">');
  };
}
function render(tokens, idx) {
  if (tokens[idx].nesting === 1) {
    let index = idx + 1;
    var html = '';
    var style = '';
    var script = '';
    while (tokens[index].nesting === 0) {
      const content = tokens[index].content;
      const tag = tokens[index].info;
      if (tag === 'html') {
        html = convert(striptags.strip(content, ['script', 'style'])).replace(
          /(<[^>]*)=""(?=.*>)/g,
          '$1'
        );
        script = striptags.fetch(content, 'script');
        style = striptags.fetch(content, 'style');
      } else if (tag === 'js' && !script) {
        script = striptags.fetch(content, 'script');
      } else if (
        ['css', 'style', 'scss'].indexOf(tag) !== -1 &&
        !style
      ) {
        style = striptags.fetch(content, 'style');
      }
      index++;
    }
    var jsfiddle = { html: html, script: script, style: style };

    jsfiddle = md.utils.escapeHtml(JSON.stringify(jsfiddle));
    return `
      </section>
      <demo-block :jsfiddle="${jsfiddle}">
        <div slot="source">${html}</div>
        <div class="hljs highlight" slot="highlight">
    `;
  }
  return '</div></demo-block>\n<section class="markdown-body">';
}
function mdPreprocess(md, source) {
  md.renderer.rules.table_open = function () {
    return '<table class="table">';
  };
  md.renderer.rules.fence = wrap(md.renderer.rules.fence);
  return source;
}

exports.demoContainer = [
  require('markdown-it-container'),
  'demo',
  {
    validate: function (params) {
      return params.trim().match(/^demo\s*(.*)$/);
    },
    render: render
  }
];

exports.render = (md, source) => {
  /**
   * override default parser rules by adding v-pre attribute on 'code' and 'pre' tags
   * @param {Array<string>} rules rules to override
   */
  function overrideParserRules(rules) {
    if (md && md.renderer && md.renderer.rules) {
      var parserRules = md.renderer.rules;
      rules.forEach(rule => {
        if (parserRules && parserRules[rule]) {
          var defaultRule = parserRules[rule];
          parserRules[rule] = function () {
            return addVuePreviewAttr(defaultRule.apply(this, arguments));
          };
        }
      });
    }
  }

  overrideParserRules(['code_inline', 'code_block', 'fence']);
  source = mdPreprocess(md, source);
  source = source.replace(/@/g, '__at__');

  let content = md.render(source).replace(/__at__/g, '@');

  content = `<section class="markdown-body">${content}</section>`;
  const result = renderVueTemplate(content, 'div');

  return result;
};
