<template>
  <li>
    <div
      :class="{bold: isFolder}"
      @click="toggle">
      {{model.name}}
      <span v-if="isFolder">[{{open ? '-' : '+'}}]</span>
    </div>
    <ul v-show="open" v-if="isFolder">
      <tree-node
        class="tree-node"
        v-for="model in model.children"
        :model="model">
      </tree-node>
    </ul>
  </li>
</template>

<script>
export default {
  name: 'tree-node',
  props: {
    model: Object,
  },
  data() {
    return {
      open: true,
    };
  },
  computed: {
    isFolder() {
      return this.model.children &&
        this.model.children.length;
    },
  },
  methods: {
    toggle() {
      if (this.isFolder) {
        this.open = !this.open;
      }
    },
  },
};
</script>
