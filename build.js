const fs = require('fs');
var path = require('path');
const esbuild = require('esbuild');
const cssModulesPlugin = require('esbuild-css-modules-plugin');

if (!fs.existsSync('./dist')) {
  fs.mkdirSync('./dist');
}

if (!fs.existsSync('./dist/public')) {
  fs.mkdirSync('./dist/public');
}

function copyFileSync(source, target) {
  var targetFile = target;
  if (fs.existsSync(target)) {
    if (fs.lstatSync(target).isDirectory()) {
      targetFile = path.join(target, path.basename(source));
    }
  }
  fs.writeFileSync(targetFile, fs.readFileSync(source), {});
}

function copyFolderRecursiveSync(source, target) {
  var files = [];
  var targetFolder = path.join(target, path.basename(source));
  if (!fs.existsSync(targetFolder)) {
    fs.mkdirSync(targetFolder);
  }
  if (fs.lstatSync(source).isDirectory()) {
    files = fs.readdirSync(source);
    files.forEach(function(file) {
      var curSource = path.join(source, file);
      if (fs.lstatSync(curSource).isDirectory()) {
        copyFolderRecursiveSync(curSource, targetFolder);
      } else {
        copyFileSync(curSource, targetFolder);
      }
    });
  }
}

(async () => {
  const result = await esbuild
    .build({
      format: 'esm',
      entryPoints: [
        'src/main.jsx',
        // './webaverse.js'
      ],
      bundle: true,
      minify: true,
      sourcemap: true,
      splitting: true,
      platform: 'browser',
      treeShaking: true,
      resolveExtensions: ['.js', '.jsx', '.json'],
      define: {
        this: 'window',
      },
      external: [
        'require',
        'fs',
        'path',
        'module',
        '/public/*',
        '/public/bin/*',
        'pre.js',
      ],
      target: ['chrome80', 'firefox72', 'safari13', 'edge80'],
      outdir: 'dist',
      watch: false,
      loader: {
        '.png': 'file',
        '.svg': 'text',
        '.ttf': 'file',
        '.woff': 'file',
        '.woff2': 'file',
        '.gltf': 'json',
        '.glb': 'file',
        '.jpg': 'file',
        '.mp3': 'file',
        '.mp4': 'file',
        '.ogg': 'file',
        '.wav': 'file',
        '.m4a': 'file',
        '.mov': 'file',
        '.scn': 'json',
        '.metaversefile': 'json',
      },
      plugins: [
        cssModulesPlugin({
          inject: false,
          localsConvention: 'camelCaseOnly',
          generateScopedName: (name, filename, css) => string,
          cssModulesOption: {},
          v2: true,
        }),
      ],
    });

  const text = await esbuild.analyzeMetafile(result.metafile);

  fs.readFile('./index.html', function(err, html) {
    if (err) {
      throw err;
    }
    var result = html.toString();
    result = result.replace('main.jsx', 'main.js');
    result = result.replace('index.css', 'src/main.css');

    fs.writeFile('./dist/index.html', result, {
      encoding: 'utf8',
    }, function(err) {});
  });

  copyFileSync('./pre.js', './dist/pre.js');

  copyFolderRecursiveSync('./public', './dist');
})();
