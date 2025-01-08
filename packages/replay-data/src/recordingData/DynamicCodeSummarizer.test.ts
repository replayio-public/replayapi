


function populateSample() {
  return `class A {
    async f() {
      this.rules = [];
  
      const nodeObject = await objectCache.readAsync(
        this.replayClient,
        this.pauseId,
        this.nodeId,
        "canOverflow"
      );
      const node = nodeObject?.preview?.node;
  
      if (!node) {
        return;
      }
  
      const wiredRules = await appliedRulesCache.readAsync(
        this.replayClient,
        this.pauseId,
        this.nodeId
      );
  
      // Show rules applied to pseudo-elements first.
      for (const { rule, pseudoElement } of wiredRules) {
        if (pseudoElement) {
          this._maybeAddRule(rule, undefined, pseudoElement);
        }
      }
  
      // The inline rule has higher priority than applied rules.
      if (node.style) {
        const inlineStyleObject = await objectCache.readAsync(
          this.replayClient,
          this.pauseId,
          node.style,
          "canOverflow"
        );
        const styleFront = new StyleFront(inlineStyleObject);
        this._maybeAddRule(styleFront);
      }
  
      // Show rules applied directly to the element in priority order.
      for (const { rule, pseudoElement } of wiredRules) {
        if (!pseudoElement) {
          this._maybeAddRule(rule);
        }
      }
  
      let parentNodeId = node.parentNode;
  
      // Show relevant rules applied to parent elements.
      while (parentNodeId) {
        const parentObject = await objectCache.readAsync(
          this.replayClient,
          this.pauseId,
          parentNodeId,
          "canOverflow"
        );
        const parentNode = parentObject.preview?.node;
        if (!parentNode) {
          break;
        }
        const parentNodeWithId = { nodeId: parentNodeId, node: parentNode };
  
        if (parentNode.nodeType == Node.ELEMENT_NODE) {
          if (parentNode.style) {
            const styleObject = await objectCache.readAsync(
              this.replayClient,
              this.pauseId,
              parentNode.style!,
              "canOverflow"
            );
            const parentInline = new StyleFront/*BREAK1*/(styleObject);
            if (parentInline.properties.length > 0) {
              this._maybeAddRule(parentInline, parentNodeWithId);
            }
          }
  
          const parentApplied = await appliedRulesCache.readAsync(
            this.replayClient,
            this.pauseId,
            parentNodeId
          );
  
          if (parentApplied === null) {
            this.rules = null;
            return;
          }
  
          for (const { rule, pseudoElement } of parentApplied) {
            if (!pseudoElement) {
              this._maybeAddRule(rule, parentNodeWithId);
            }
          }
        }
  
        if (parentObject.preview?.node?.nodeName === "HTML") {
          break;
        }
  
        parentNodeId = parentNode.parentNode;
      }
  
      // Store a list of all pseudo-element types found in the matching rules.
      this.pseudoElements = this.rules.filter(r => r.pseudoElement).map(r => r.pseudoElement);
  
      // Mark overridden computed styles.
      this.onRuleUpdated();
    }
  }`;
}