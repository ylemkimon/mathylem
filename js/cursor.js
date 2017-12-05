export default class Cursor {
  constructor(node = null, pos) {
    this.set(node, pos);
  }

  set(node, pos) {
    if (!node) {
      this.node = null;
      this.pos = NaN;
      return;
    }

    if (node.nodeName === 'f') {
      let nn = node.firstChild;
      while (nn != null && (nn.childNodes.length > 1 || nn.firstChild.textContent.length > 0)) {
        nn = nn.nextSibling;
      }
      if (nn != null) {
        node = nn;
      } else {
        node = this.node.firstChild;
        pos = true;
      }
    }
    while (node.nodeName !== 'e') {
      node = pos ? node.lastChild : node.firstChild;
    }
    this.node = node;
    if (typeof pos === 'number') {
      this.pos = pos;
    } else {
      this.pos = pos ? this.node.textContent.length : 0;
    }
  }

  get value() {
    return this.node.textContent;
  }

  set value(val) {
    this.node.textContent = val;
  }

  clone() {
    return new Cursor(this.node, this.pos);
  }

  equals(other) {
    return other != null && this.node === other.node && this.pos === other.pos;
  }

  directionTo(other) {
    if (this.node !== other.node) {
      for (let node = other.node; node != null; node = node.previousSibling) {
        if (node === this.node) {
          return 1;
        }
      }
      return -1;
    }
    return Math.sign(other.pos - this.pos);
  }
}
