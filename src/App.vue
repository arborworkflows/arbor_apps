<template>
  <div class="app-viewport">
    <md-toolbar class="main-toolbar">
      <h2 class="md-title" style="flex: 1">Arbor</h2>
    </md-toolbar>
    <main class="main-content">
      <girder-file-dialog label="Phylogenetic Tree (.phy)" @change="setTree"></girder-file-dialog>
      <girder-file-dialog label="Character Matrix (.csv)" @change="setTable"></girder-file-dialog>

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
          <data-table v-else :data="tableData" :columns="tableColumns"></data-table>
        </md-tab>

        <md-tab md-label="Phylogenetic signal" :md-active="activeTab === 'phylogenetic-signal'">
          <md-input-container>
            <label for="column">Column</label>
            <md-select name="column" id="column" :value="phylogeneticSignal.column" @change="updatePhylogeneticSignalColumn">
              <md-option v-for="column in tableColumns" :key="column" :value="column">{{ column }}</md-option>
            </md-select>
          </md-input-container>
          <div v-if="phylogeneticSignal.processing" class="centered">
            <md-spinner :md-size="150" md-indeterminate class="md-accent"></md-spinner>
          </div>
          <data-table v-else :data="phylogeneticSignal.resultData" :columns="phylogeneticSignal.resultColumns"></data-table>
        </md-tab>

        <md-tab md-label="Ancestral state reconstruction" :md-active="activeTab === 'ancestral-state'">
          <md-input-container>
            <label for="column">Column</label>
            <md-select name="column" id="column" :value="ancestralState.column" @change="updateAncestralStateColumn">
              <md-option v-for="column in tableColumns" :key="column" :value="column">{{ column }}</md-option>
            </md-select>
          </md-input-container>
          <div v-if="ancestralState.processing" class="centered">
            <md-spinner :md-size="150" md-indeterminate class="md-accent"></md-spinner>
          </div>
          <div v-else>
            <md-image :md-src="ancestralState.plotImage"></md-image>
            <data-table :data="ancestralState.resultData" :columns="ancestralState.resultColumns"></data-table>
          </div>
        </md-tab>

        <md-tab md-label="PGLS" :md-active="activeTab === 'pgls'">
          <md-input-container>
            <label for="column">X (independent variable)</label>
            <md-select name="column" id="column" :value="pgls.x" @change="updatePglsX">
              <md-option v-for="column in tableColumns" :key="column" :value="column">{{ column }}</md-option>
            </md-select>
          </md-input-container>
          <md-input-container>
            <label for="column">Y (dependent variable)</label>
            <md-select name="column" id="column" :value="pgls.y" @change="updatePglsY">
              <md-option v-for="column in tableColumns" :key="column" :value="column">{{ column }}</md-option>
            </md-select>
          </md-input-container>
          <div v-if="pgls.processing" class="centered">
            <md-spinner :md-size="150" md-indeterminate class="md-accent"></md-spinner>
          </div>
          <div v-else>
            <data-table :data="pgls.resultData" :columns="pgls.resultColumns"></data-table>
            <md-image :md-src="pgls.plotImage"></md-image>
          </div>
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
    'treeProcessing',
    'treeData',
    'phylogeneticSignal',
    'ancestralState',
    'pgls',
  ]),
  methods: {
    ...mapActions([
      'setTable',
      'setTree',
      'updatePhylogeneticSignalColumn',
      'updateAncestralStateColumn',
      'updatePglsX',
      'updatePglsY',
    ]),
    updateActiveTab(tabIndex) {
      const tabName = ['tree', 'table', 'phylogenetic-signal', 'ancestral-state', 'pgls'];
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
