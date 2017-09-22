<template>
  <svg :width="width" :height="height">
    <g>
      <path v-for="(link, index) in links" class="link" :key="index" :d="link.d" :style="link.style"></path>
    </g>
    <g v-for="(node, index) in nodes" :key="index" :style="node.style">
      <!-- <circle :r="node.r"></circle> -->
      <text :dx="node.textPos.x" :dy="node.textPos.y" :style="node.textStyle">{{ node.text }}</text>
    </g>
  </svg>
</template>

<script>
import { hierarchy, cluster } from 'd3-hierarchy';
import { scaleLinear } from 'd3-scale';
import { extent } from 'd3-array';

export default {
  props: {
    tree: Object,
    width: {
      type: Number,
      default: 1000,
    },
    height: {
      type: Number,
      default: 1000,
    },
  },
  computed: {
    root() {
      const treeCopy = JSON.parse(JSON.stringify(this.tree));
      const rootNode = cluster().size([this.height, this.width]).separation(() => 1)(hierarchy(treeCopy));
      rootNode.distance = 0;
      rootNode.descendants().slice(1).forEach((node) => {
        node.distance = node.parent.distance + node.data.branch_length;
      });
      return rootNode;
    },
    distanceScale() {
      if (this.root) {
        return scaleLinear().domain(extent(this.root.descendants(), d => d.distance)).range([10, this.width - 200]);
      }
      return null;
    },
    nodes() {
      if (this.root) {
        return this.root.descendants().map(d => ({
          // r: 2.5,
          style: {
            transform: `translate(${this.distanceScale(d.distance)}px, ${d.x}px)`,
          },
          text: d.data.name,
          textPos: {
            x: d.children ? -8 : 8,
            y: 3,
          },
          textStyle: {
            textAnchor: d.children ? 'end' : 'start',
            fontSize: '10px',
          },
        }));
      }
      return [];
    },
    links() {
      if (this.root) {
        return this.root.descendants().slice(1).map(d => ({
          d: `M${this.distanceScale(d.distance)},${d.x}` +
            `L${this.distanceScale(d.parent.distance)},${d.x}` +
            `L${this.distanceScale(d.parent.distance)},${d.parent.x}`,
          style: { stroke: 'black', fill: 'none' },
        }));
      }
      return [];
    },
  },
};
</script>
<style scoped>
svg {
  max-width: none;
}

text {
  font-style: normal;
  font-size: 10px;
}
</style>
