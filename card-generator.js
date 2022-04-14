import metaversefile from 'metaversefile';
import {generateStats, types} from './procgen/procgen.js';
import {screenshotObjectApp} from './object-screenshotter.js';
import {screenshotAvatarUrl} from './avatar-screenshotter.js';
import {generateGlyph} from './glyph-generator.js';

// const baseUrl = import.meta.url.replace(/(\/)[^\/\\]*$/, '$1');
// const cardsSvgUrl = `${baseUrl}cards.svg`;
const cardsSvgUrl = `./images/cards-01.svg`;

const _loadSvg = async () => {
  const res = await fetch(cardsSvgUrl);
  const cardSvgSource = await res.text();
  return cardSvgSource;
};
let svgLoadPromise = null;
const _waitForSvgLoad = () => {
  if (svgLoadPromise === null) {
    svgLoadPromise = _loadSvg();
  }
  return svgLoadPromise;
};

const _loadFonts = () => Promise.all([
  'FuturaLT-Condensed',
  'GillSans-CondensedBold',
  'FuturaStd-Heavy',
  'PlazaITC-Normal',
  'MS-Gothic',
  'GillSans',
  'GillSans-ExtraBoldDisplay',
  'FuturaLT-CondensedBold',
  'SanvitoPro-Regular',
].map(fontFamily => document.fonts.load(`16px "${fontFamily}"`)))
.catch(err => {
  console.warn(err);
});
let fontsLoadPromise = null;
const _waitForFontsLoad = () => {
  if (fontsLoadPromise === null) {
    fontsLoadPromise = _loadFonts();
  }
  return fontsLoadPromise;
};

let tempCanvas = null;
const _getTempCanvas = () => {
  if (tempCanvas === null) {
    tempCanvas = document.createElement('canvas');
    tempCanvas.width = 0;
    tempCanvas.height = 0;
  }
  return tempCanvas;
};
// Fragment text function to calculate line breaks in dynamic text
// https://itsahappymedium.com/create/blog/canvas-text-wrapping/
function fragmentText(context, maxWidth, text, padding) {

  // return text;
  
  let lines = [],
      words = text.split(' ');

  // Whoops - something went terribly wrong
  if (maxWidth === NaN) return [text];

  // We'll be constantly removing words from our words array to build our lines. Once we're out of words, we can stop
  while (words.length) {
      var tmp = words[0]; // Capture the current word, in case we need to re-add it to array
      var line = words.shift(); // Start our line with the first word available to us

      // Now we'll continue adding words to our line until we've exceeded our budget
      while ( words.length && context.measureText(line).width < maxWidth) {
          tmp = words[0];
          line = line + " " + words.shift();
      }

      // If the line is too long, remove the last word and replace it in words array.
      // This will happen on all but the last line, as we anticipate exceeding the length to break out of our second while loop
      if (context.measureText(line).width > maxWidth) {
          if(line.lastIndexOf(' ') != -1) {
              // console.log('with space');
              line = line.substring(0, line.lastIndexOf(' '));
              words.unshift(tmp);
          } else {
              // console.log('our split');
              var part1 = line.substring(0,12) + '-';
              var part2 = line.substring(12);
              //words.push(part1);
              words.push(part2);
              line = part1;

          }

          // line = line.substring(0, line.lastIndexOf(' '));
          // words.unshift(tmp);
      }

      // Push the finshed line into the array

          lines.push(line);
  }

  return lines;
}

const _getCanvasBlob = canvas => new Promise((resolve, reject) => {
  canvas.toBlob(blob => {
    resolve(blob);
  });
});
const _getBlobDataUrl = async blob => new Promise((resolve, reject) => {
  const fileReader = new FileReader();
  fileReader.onload = () => {
    resolve(fileReader.result);
  };
  fileReader.onerror = reject;
  fileReader.readAsDataURL(blob);
});
const _getCanvasDataUrl = async canvas => {
  const blob = await _getCanvasBlob(canvas);
  const url = await _getBlobDataUrl(blob);
  return url;
};

const _previewImage = (image, width, height) => {
  image.style.cssText = `\
    position: fixed;
    top: 0;
    left: 0;
    width: ${width}px;
    /* height: ${height}px; */
    z-index: 100;
  `;
  // console.log('got image', image);
  document.body.appendChild(image);
};

export const generateObjectUrlCard = async ({
  start_url,
  width = 300,
  height = 300,
}) => {
  const app = await metaversefile.createAppAsync({
    start_url,
  });
  return await generateObjectCard({
    app,
    width,
    height,
  });
};
export const generateObjectCard = async ({
  app,
  width = 300,
  height = 300,
}) => {
  const stats = generateStats(app.contentId);
  const {
    name,
    description,
    contentId,
    appType,
  } = app;
  const url = contentId;
  const type = appType;

  let objectImage = await screenshotObjectApp({
    app,
  });
  objectImage = await _getCanvasDataUrl(objectImage);

  let minterAvatarPreview = await screenshotAvatarUrl({
    start_url: `./avatars/4205786437846038737.vrm`,
  });
  minterAvatarPreview = await _getCanvasDataUrl(minterAvatarPreview);

  let glyphImage = generateGlyph(url);
  glyphImage = await _getCanvasDataUrl(glyphImage);

  // _previewImage(minterAvatarPreview, width, height);
  const minterUsername = 'Scillia';
  console.log('call generate card', {
    stats,
    width,
    name,
    description,
    objectImage,
    minterUsername,
    minterAvatarPreview,
    glyphImage,
  });
  const cardImg = await generateCard({
    stats,
    width,
    name,
    description,
    url,
    type,
    objectImage,
    minterUsername,
    minterAvatarPreview,
    glyphImage,
  });
  _previewImage(cardImg, width, height);
  return cardImg;
};

export const generateCard = async ({
  stats: spec,
  width: cardWidth,
  name,
  description,
  url,
  type,
  objectImage,
  minterUsername,
  minterAvatarPreview,
  glyphImage,
} = {}) => {
  description = description || 'A great mystery.';
  
  const cardSvgSource = await _waitForSvgLoad();
  await _waitForFontsLoad();
  const canvas = _getTempCanvas();
  const ctx = canvas.getContext('2d');

  const cardHeight = cardWidth / 2.5 * 3.5;

  // console.log('card procgen', {name, description});

  const svg = document.createElement('svg');
  svg.setAttribute('xmlns', `http://www.w3.org/2000/svg`);
  svg.setAttribute('width', cardWidth);
  svg.setAttribute('height', cardHeight);
  svg.innerHTML = cardSvgSource;

  {
    const el = svg;

    // name
    {
      const nameEl = el.querySelector('#name');
      nameEl.innerHTML = name;
    }

    // type
    {
      const typeEl = el.querySelector('#type');
      typeEl.innerHTML = type.toUpperCase();
    }

    // illustrator name
    {
      const illustratorNameEl = el.querySelector('#illustrator-name');
      illustratorNameEl.innerHTML = minterUsername;
    }

    // type icon
    for (let i = 0; i < types.length; i++) {
      const type = types[i];
      const typeEl = el.querySelector('#type-' + type);
      typeEl.style.display = type === spec.stats.type ? 'block' : 'none';
    }

    // stat values
    [
      'level',
      'hp',
      'mp',
      'atk',
      'def',
      'mag',
      'spr',
      'dex',
      'lck',
    ].forEach(statName => {
      const statEl = el.querySelector('#' + statName + '-value');
      statEl.innerHTML = escape(spec.stats[statName] + '');
    });

    // main image
    {
      const mainImageEl = el.querySelector('#main-image');
      mainImageEl.setAttribute('xlink:href', objectImage);
    }

    // illustrator image
    {
      const illustartorImageEl = el.querySelector('#illustrator-image');
      illustartorImageEl.setAttribute('xlink:href', minterAvatarPreview);
    }

    // url
    {
      const urlEl = el.querySelector('#url');
      urlEl.innerHTML = url;
    }

    // glyph image
    {
      const glyphImageEl = el.querySelector('#glyph-image');
      glyphImageEl.setAttribute('image-rendering', 'pixelated');
      glyphImageEl.setAttribute('xlink:href', glyphImage);
    }

    {
      const descriptionEl = el.querySelector('#description');

      document.body.appendChild(svg);
      const bbox = descriptionEl.getBBox();
      const {width, height} = bbox;
      // console.log('bbox', bbox);
      document.body.removeChild(svg);

      ctx.font = '12px SanvitoPro-Regular';
      let description2 = fragmentText(ctx, width, description);
      if (description2.length > 2) {
        description2 = description2.slice(0, 2);
        description2[description2.length - 1] += '…';
      }

      // const {height} = ctx.measureText('W');
      // console.log('textMetrics', textMetrics);
      // console.log('description2', {description2, height});

      // debugger;
      // descriptionEl.style.whiteSpace = 'pre';
      // descriptionEl.setAttributeNS("http://www.w3.org/XML/1998/namespace", "xml:space", "preserve");
      descriptionEl.innerHTML = description2.map((l, i) => {
        return `<tspan x="0" y="${i * height * 1}">${l}</tspan>`;
      }).join('');

      /* const lines = description.split('\n');
      const descriptionHeaderTextEl = el.querySelector('#description-header-text');
      descriptionHeaderTextEl.innerHTML = lines[0];
      const descriptionBodyTextEl = el.querySelector('#description-body-text');
      descriptionBodyTextEl.innerHTML = lines.slice(1).join('\n'); */
    }

    {
      const linearGradientName = 'linear-gradient-120';
      const stopEls = el.querySelectorAll(`#${linearGradientName} > stop`);
      // const c = `stop-color:${spec.art.colors[0]}`;
      stopEls[1].style.cssText = `stop-color:${spec.art.colors[0]}`;
      stopEls[3].style.cssText = `stop-color:${spec.art.colors[1]}`;
    }
  }

  const image = await new Promise((accept, reject) => {
    const image = document.createElement('img');
    image.onload = () => {
      accept(image);
      cleanup();
    };
    image.onerror = err => {
      reject(err);
      cleanup();
    };
    image.crossOrigin = 'Anonymous';

    const outerHTML = svg.outerHTML;
    // console.log('outer html', outerHTML);
    const blob = new Blob([outerHTML], {
      type: 'image/svg+xml',
    });
    const url = URL.createObjectURL(blob);
    image.src = url;

    function cleanup() {
      URL.revokeObjectURL(url);
    }
  });

  return image;
};