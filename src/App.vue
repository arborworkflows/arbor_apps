<template>
  <div class="app-viewport">
    <md-toolbar class="main-toolbar">
      <img class="app-logo" src="static/arbor-basic.png">
      <h2 class="md-title" style="flex: 1">Arbor</h2>
    </md-toolbar>

    <md-tabs @change="updateActiveTab">
      <md-tab md-label="Phylogenetic tree" :md-active="activeTab === 'tree'">
        <girder-file-dialog label="Phylogenetic Tree (.phy)" @change="setTree"></girder-file-dialog>
        <div>
          <md-button class="md-icon-button" @click="zoom(0.8)">
            <md-icon>zoom_out</md-icon>
          </md-button>
          <md-button class="md-icon-button" @click="zoom(1.25)">
            <md-icon>zoom_in</md-icon>
          </md-button>
        </div>
        <div class="scrollable">
          <div v-if="treeProcessing">
            <md-spinner :md-size="150" md-indeterminate class="md-accent"></md-spinner>
          </div>
          <phylo-tree v-else :tree="treeData" :width="treeWidth" :height="treeHeight"></phylo-tree>
        </div>
      </md-tab>

      <md-tab md-label="Character matrix" :md-active="activeTab === 'table'">
        <girder-file-dialog label="Character Matrix (.csv)" @change="setTable"></girder-file-dialog>
        <div v-if="tableProcessing">
          <md-spinner :md-size="150" md-indeterminate class="md-accent"></md-spinner>
        </div>
        <data-table v-else :data="tableData" :columns="tableColumns"></data-table>
      </md-tab>

      <md-tab v-if="tree.id && table.id" md-label="Phylogenetic signal" :md-active="activeTab === 'phylogenetic-signal'">
        <span class="md-caption">Column</span>
        <div>
          <div v-for="column in tableColumns" :class="['chip', { 'chip-active': phylogeneticSignal.column === column }]" @click="updatePhylogeneticSignalColumn(column)">{{ column }}</div>
        </div>
        <span class="md-caption">{{ phylogeneticSignal.status }}</span>
        <div v-if="phylogeneticSignal.processing">
          <md-spinner :md-size="150" md-indeterminate class="md-accent"></md-spinner>
        </div>
        <data-table v-else :data="phylogeneticSignal.resultData" :columns="phylogeneticSignal.resultColumns"></data-table>
      </md-tab>

      <md-tab v-if="tree.id && table.id" md-label="Ancestral state" :md-active="activeTab === 'ancestral-state'">
        <span class="md-caption">Column</span>
        <div>
          <div v-for="column in tableColumns" :class="['chip', { 'chip-active': ancestralState.column === column }]" @click="updateAncestralStateColumn(column)">{{ column }}</div>
        </div>
        <span class="md-caption">{{ ancestralState.status }}</span>
        <div v-if="ancestralState.processing">
          <md-spinner :md-size="150" md-indeterminate class="md-accent"></md-spinner>
        </div>
        <div v-else>
          <md-image :md-src="ancestralState.plotImage"></md-image>
          <data-table :data="ancestralState.resultData" :columns="ancestralState.resultColumns"></data-table>
        </div>
      </md-tab>

      <md-tab v-if="tree.id && table.id" md-label="PGLS" :md-active="activeTab === 'pgls'">
        <span class="md-caption">X (independent variable)</span>
        <div>
          <div v-for="column in tableColumns" :class="['chip', { 'chip-active': pgls.x === column }]" @click="updatePglsX(column)">{{ column }}</div>
        </div>
        <span class="md-caption">Y (dependent variable)</span>
        <div>
          <div v-for="column in tableColumns" :class="['chip', { 'chip-active': pgls.y === column }]" @click="updatePglsY(column)">{{ column }}</div>
        </div>
        <div>
          <span class="md-caption">Model for residuals</span>
          <div>
            <div v-for="pglsModel in pglsModels" :class="['chip', { 'chip-active': pgls.model === pglsModel }]" @click="updatePglsModel(pglsModel)">{{ pglsModel }}</div>
          </div>
          <!-- <md-button-toggle id="pgls-model" md-single>
            <md-button v-for="pglsModel in pglsModels" :class="{ 'md-toggle': pgls.model === pglsModel }" @click="updatePglsModel(pglsModel)">{{ pglsModel }}</md-button>
          </md-button-toggle> -->
        </div>
        <span class="md-caption">{{ pgls.status }}</span>
        <div v-if="pgls.processing">
          <md-spinner :md-size="150" md-indeterminate class="md-accent"></md-spinner>
        </div>
        <div v-else>
          <data-table :data="pgls.resultData" :columns="pgls.resultColumns"></data-table>
          <md-image :md-src="pgls.plotImage"></md-image>
        </div>
      </md-tab>

      <md-tab v-if="tree.id && table.id" md-label="PIC" :md-active="activeTab === 'pic'">
        <span class="md-caption">X (independent variable)</span>
        <div>
          <div v-for="column in tableColumns" :class="['chip', { 'chip-active': pic.x === column }]" @click="updatePicX(column)">{{ column }}</div>
        </div>
        <span class="md-caption">Y (dependent variable)</span>
        <div>
          <div v-for="column in tableColumns" :class="['chip', { 'chip-active': pic.y === column }]" @click="updatePicY(column)">{{ column }}</div>
        </div>
        <span class="md-caption">{{ pic.status }}</span>
        <div v-if="pic.processing">
          <md-spinner :md-size="150" md-indeterminate class="md-accent"></md-spinner>
        </div>
        <div v-else>
          <data-table :data="pic.summaryData" :columns="pic.summaryColumns"></data-table>
          <data-table :data="pic.picData" :columns="pic.picColumns"></data-table>
        </div>
      </md-tab>

    </md-tabs>
  </div>
</template>

<script>
import { mapState, mapActions } from 'vuex';
import GirderFileDialog from './components/GirderFileDialog';
import DataTable from './components/DataTable';
import PhyloTree from './components/PhyloTree';

export default {
  name: 'app',
  components: {
    GirderFileDialog,
    DataTable,
    PhyloTree,
  },
  data: () => ({
    pglsModels: ['BM', 'OU', 'Pagel', 'ACDC'],
    tabs: ['tree', 'table', 'phylogenetic-signal', 'ancestral-state', 'pgls', 'pic'],
  }),
  computed: mapState([
    'activeTab',
    'table',
    'tableProcessing',
    'tableColumns',
    'tableData',
    'tree',
    'treeProcessing',
    'treeData',
    'treeWidth',
    'treeHeight',
    'phylogeneticSignal',
    'ancestralState',
    'pgls',
    'pic',
  ]),
  methods: {
    ...mapActions([
      'setTable',
      'setTree',
      'updatePhylogeneticSignalColumn',
      'updateAncestralStateColumn',
      'updatePglsX',
      'updatePglsY',
      'updatePglsModel',
      'updatePicX',
      'updatePicY',
    ]),
    updateActiveTab(tabIndex) {
      this.$store.commit('UPDATE_ACTIVE_TAB', { tab: this.tabs[tabIndex] });
    },
    zoom(amount) {
      this.$store.commit('UPDATE_TREE_ZOOM', { amount });
    },
  },
};
</script>

<style scoped>
html,
body,
.app-logo {
  height: 32px;
  width: 32px;
  margin-right: 8px;
}

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

.md-select select {
  display: none;
}

.chip {
  margin-right: 8px;
  margin-bottom: 4px;
  height: 32px;
  padding: 8px 12px;
  display: inline-block;
  border-radius: 32px;
  transition: all .4s cubic-bezier(.25,.8,.25,1);
  font-size: 13px;
  line-height: 16px;
  white-space: nowrap;
  background-color: rgba(0, 0, 0, 0.12);
  cursor: pointer;
}

.chip:hover {
  background-color: rgba(0, 0, 0, 0.54);
  color: #fff;
}

.chip-active {
  background-color: rgba(0, 0, 0, 0.54);
  color: #fff;
}

.scrollable {
  max-width: 100%;
  overflow: scroll;
}
</style>
