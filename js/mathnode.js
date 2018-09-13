import SymbolTree from 'symbol-tree';

const symbolTree = new SymbolTree();

export default class Node {
  constructor(name, content = '') {
    this.nodeName = name;
    this.textContent = content;
  }

  get firstChild() {
    return symbolTree.firstChild(this);
  }

  get lastChild() {
    return symbolTree.lastChild(this);
  }

  get previousSibling() {
    return symbolTree.previousSibling(this);
  }

  get nextSibling() {
    return symbolTree.nextSibling(this);
  }

  get parentNode() {
    return symbolTree.parent(this);
  }

  get childNodes() {
    return symbolTree.childrenToArray(this);
  }

  get childrenCount() {
    return symbolTree.childrenCount(this);
  }

  getAttribute(attr) {
    return this[attr];
  }

  setAttribute(attr, value) {
    this[attr] = value;
  }

  removeAttribute(attr) {
    this[attr] = undefined;
  }

  appendChild(c) {
    symbolTree.appendChild(this, c);
  }

  removeChild(c) {
    symbolTree.remove(c);
  }

  get index() {
    return symbolTree.index(this);
  }

  get preceding() {
    return symbolTree.preceding(this);
  }

  get following() {
    return symbolTree.following(this);
  }

  insertBefore(c1, c2) {
    if (c2 === null) {
      this.appendChild(c1);
      return;
    }
    symbolTree.insertBefore(c2, c1);
  }

  cloneNode() {
    const node = new Node(this.nodeName, this.textContent);
    for (let child of symbolTree.childrenIterator(this)) {
      node.appendChild(child.cloneNode());
    }
    return node;
  }
}
