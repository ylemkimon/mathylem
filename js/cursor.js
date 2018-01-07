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
    this.node = node;
    this.pos = pos;

    if (this.node.nodeName === 'f') {
      this.node = this.node.firstChild;
      while (this.node != null && (this.node.childNodes.length > 1 ||
          this.node.firstChild.textContent.length > 0)) {
        this.node = this.node.nextSibling;
      }
      if (this.node == null) {
        this.node = node.firstChild;
        this.pos = true;
      }
    }
    while (this.node.nodeName !== 'e') {
      this.node = this.pos ? this.node.lastChild : this.node.firstChild;
    }
    if (typeof this.pos !== 'number') {
      this.pos = this.pos ? this.value.length : 0;
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
    const diff = other.pos - this.pos;
    return diff > 0 ? 1 : (diff && -1);
  }
}
