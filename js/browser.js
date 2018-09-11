/* eslint-env browser */
import MathYlem from './mathylem';
import 'katex/dist/katex.min.css';
import '../css/mathylem.less';

if (process.env.NODE_ENV !== 'production') {
  const element = document.createElement('div');
  element.style.width = '100%';
  element.style.maxWidth = '900px';
  document.body.appendChild(element);
  new MathYlem(element); // eslint-disable-line no-new
}

export default MathYlem;
