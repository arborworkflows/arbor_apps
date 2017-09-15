<template>
  <div class="app-viewport">
    <md-toolbar class="main-toolbar">
      <h2 class="md-title" style="flex: 1">Phylogenetic Signal</h2>
    </md-toolbar>
    <main class="main-content">
      <girder-file-dialog label="Phylogenetic Tree (.phy)" @change="setTree"></girder-file-dialog>
      <girder-file-dialog label="Character Matrix (.csv)" @change="setTable"></girder-file-dialog>
      <md-input-container>
        <label for="column">Column</label>
        <md-select name="column" id="column" :value="column" @change="updateColumn">
          <md-option v-for="column in tableColumns" :key="column" :value="column">{{ column }}</md-option>
        </md-select>
      </md-input-container>

      <md-tabs @change="updateActiveTab">
        <md-tab md-label="Phylogenetic tree" :md-active="activeTab === 'tree'">
          <div v-if="treeProcessing" class="centered">
            <md-spinner :md-size="150" md-indeterminate class="md-accent"></md-spinner>
          </div>
          <tree v-else :data="treeData"></tree>
        </md-tab>

        <md-tab md-label="Character matrix" :md-active="activeTab === 'table'">
          <div v-if="tableProcessing" class="centered">
            <md-spinner :md-size="150" md-indeterminate class="md-accent"></md-spinner>
          </div>
          <data-table v-else :data="tableData" :columns="tableColumns">
        </md-tab>

        <md-tab md-label="Result" :md-active="activeTab === 'result'">
          <div v-if="taskProcessing" class="centered">
            <md-spinner :md-size="150" md-indeterminate class="md-accent"></md-spinner>
          </div>
          <data-table v-else :data="resultData" :columns="resultColumns">
        </md-tab>
      </md-tabs>

    </main>
  </div>
</template>

<script>
import { mapState, mapActions } from 'vuex';
import GirderFileDialog from './components/GirderFileDialog';
import DataTable from './components/DataTable';
import Tree from './components/Tree';

export default {
  name: 'app',
  components: {
    GirderFileDialog,
    DataTable,
    Tree,
  },
  computed: mapState([
    'activeTab',
    'table',
    'tableProcessing',
    'tableColumns',
    'tableData',
    'column',
    'taskProcessing',
    'resultColumns',
    'resultData',
    'treeProcessing',
    'treeData',
  ]),
  methods: {
    ...mapActions([
      'setTable',
      'setTree',
      'updateColumn',
    ]),
    updateActiveTab(tabIndex) {
      const tabName = ['tree', 'table', 'result'];
      this.$store.commit('UPDATE_ACTIVE_TAB', { tab: tabName[tabIndex] });
    },
  },
};
</script>

<style scoped>
html,
body,
.app-viewport {
  height: 100%;
  overflow: hidden;
}

.app-viewport {
  display: flex;
  flex-flow: column;
}

.main-toolbar {
  position: relative;
  z-index: 10;
}

.main-content {
  position: relative;
  z-index: 1;
  overflow: auto;
  padding: 16px;
}

.centered {
  display: flex;
  justify-content: center;
}
</style>
