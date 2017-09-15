<template>
  <ul>
    <tree-node
      class="tree-node"
      :model="data">
    </tree-node>
  </ul>
</template>

<script>
import TreeNode from './TreeNode';

export default {
  components: {
    TreeNode,
  },
  props: ['data'],
};
</script>
