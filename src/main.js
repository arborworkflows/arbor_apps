// The Vue build version to load with the `import` command
// (runtime-only or standalone) has been set in webpack.base.conf with an alias.
import Vue from 'vue';
import VueMaterial from 'vue-material';
import VueResource from 'vue-resource';
import Vuex from 'vuex';
import { csvParse } from 'd3-dsv';
import { parse_newick as parseNewick } from 'biojs-io-newick';
import 'vue-material/dist/vue-material.css';
import App from './App';

Vue.use(VueMaterial);
Vue.use(VueResource);
Vue.use(Vuex);

Vue.config.productionTip = false;

Vue.material.registerTheme('default', {
  primary: {
    color: 'blue',
    hue: 900,
  },
  accent: {
    color: 'light-green',
    hue: 400,
  },
  warn: 'red',
  background: 'white',
});

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return undefined;
}

Vue.http.options.root = '/api/v1';
Vue.http.headers.common['Girder-Token'] = getCookie('girderToken');

function getResultsFolder(taskName) {
  const isoString = (d) => {
    const tzo = -d.getTimezoneOffset();
    const dif = tzo >= 0 ? '+' : '-';
    const pad = (num) => {
      const norm = Math.floor(Math.abs(num));
      return (norm < 10 ? '0' : '') + norm;
    };
    return d.getFullYear() + // eslint-disable-line prefer-template
      '-' + pad(d.getMonth() + 1) +
      '-' + pad(d.getDate()) +
      ' ' + pad(d.getHours()) +
      ':' + pad(d.getMinutes()) +
      ':' + pad(d.getSeconds()) +
      dif + pad(tzo / 60) +
      ':' + pad(tzo % 60);
  };

  const whenUser = Vue.http.get('user/me');
  const folderName = `${isoString(new Date())} ${taskName}`;
  return whenUser.then(({ body: user }) =>
    Vue.http.get('resource/lookup', { params: { path: `/user/${user.login}/.results` } }),
  ).then(folder => folder, () =>
    whenUser.then(({ body: user }) =>
      Vue.http.post('folder', null, { params: { parentType: 'user', parentId: user._id, name: '.results' } }),
    ),
  ).then(({ body: mainResultsFolder }) =>
    Vue.http.post('folder', null, { params: { parentId: mainResultsFolder._id, name: folderName } }),
  );
}

function runAnalysis({ taskName, inputSpec, outputSpec }) {
  return new Promise((resolve, reject) => {
    Vue.http.get('resource/search', { params: { q: taskName, mode: 'prefix', types: '["item"]' } }).then(
      (itemTask) => {
        const inputs = encodeURIComponent(JSON.stringify(inputSpec));
        const outputs = encodeURIComponent(JSON.stringify(outputSpec));
        const body = `inputs=${inputs}&outputs=${outputs}`;
        Vue.http.post(`item_task/${itemTask.body.item[0]._id}/execution`, body, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }).then((job) => {
          const jobStatus = {
            0: { name: 'Inactive', done: true },
            1: { name: 'Queued', done: false },
            2: { name: 'Running', done: false },
            3: { name: 'Success', done: true },
            4: { name: 'Error', done: true },
            5: { name: 'Cancelled', done: true },
            823: { name: 'Pushing output', done: false },
          };
          function waitForJob() {
            Vue.http.get(`job/${job.body._id}`).then((currentJob) => {
              const status = jobStatus[currentJob.body.status]
                || { name: `Status code ${currentJob.body.status}`, done: false };
              if (!status.done) {
                console.log(`waiting (${status.name})`);
                setTimeout(waitForJob, 1000);
              } else {
                console.log(`done (${status.name})`);
                if (status.name === 'Success') {
                  resolve(currentJob.body.itemTaskBindings.outputs);
                } else {
                  reject(status);
                }
              }
            });
          }
          waitForJob();
        });
      },
    );
  });
}

function runPhylogeneticSignal({ state, commit }) {
  commit('PHYLOGENETIC_SIGNAL_REQUEST');

  const taskName = 'Phylogenetic signal';

  getResultsFolder(taskName).then(({ body: folder }) =>
    runAnalysis({
      taskName,
      inputSpec: {
        tree: {
          mode: 'girder',
          resource_type: 'item',
          id: state.tree.id,
          fileName: state.tree.name,
        },
        table: {
          mode: 'girder',
          resource_type: 'item',
          id: state.table.id,
          fileName: state.table.name,
        },
        column: {
          mode: 'inline',
          data: state.phylogeneticSignal.column,
        },
      },
      outputSpec: {
        output: {
          mode: 'girder',
          parent_id: folder._id,
          parent_type: 'folder',
          name: 'signal.csv',
        },
      },
    }),
  ).then(({ output }) => {
    Vue.http.get(`item/${output.itemId}/files`).then((resp) => {
      Vue.http.get(`file/${resp.body[0]._id}/download`).then((content) => {
        const data = csvParse(content.bodyText);
        commit('PHYLOGENETIC_SIGNAL_RESULT', data);
      });
    });
  });
}

function runAncestralState({ state, commit }) {
  commit('ANCESTRAL_STATE_REQUEST');

  const taskName = 'Ancestral state reconstruction';

  getResultsFolder(taskName).then(({ body: folder }) =>
    runAnalysis({
      taskName,
      inputSpec: {
        tree: {
          mode: 'girder',
          resource_type: 'item',
          id: state.tree.id,
          fileName: state.tree.name,
        },
        table: {
          mode: 'girder',
          resource_type: 'item',
          id: state.table.id,
          fileName: state.table.name,
        },
        column: {
          mode: 'inline',
          data: state.ancestralState.column,
        },
      },
      outputSpec: {
        output: {
          mode: 'girder',
          parent_id: folder._id,
          parent_type: 'folder',
          name: 'output.csv',
        },
        plot: {
          mode: 'girder',
          parent_id: folder._id,
          parent_type: 'folder',
          name: 'plot.png',
        },
      },
    }),
  ).then(({ output, plot }) => {
    Promise.all([Vue.http.get(`item/${output.itemId}/files`), Vue.http.get(`item/${plot.itemId}/files`)]).then(([outputFiles, plotFiles]) => {
      Vue.http.get(`file/${outputFiles.body[0]._id}/download`).then((content) => {
        const data = csvParse(content.bodyText);
        commit('ANCESTRAL_STATE_RESULT', { data, plotImage: `/api/v1/file/${plotFiles.body[0]._id}/download` });
      });
    });
  });
}

function runPgls({ state, commit }) {
  commit('PGLS_REQUEST');

  const taskName = 'PGLS';

  getResultsFolder(taskName).then(({ body: folder }) =>
    runAnalysis({
      taskName,
      inputSpec: {
        tree: {
          mode: 'girder',
          resource_type: 'item',
          id: state.tree.id,
          fileName: state.tree.name,
        },
        table: {
          mode: 'girder',
          resource_type: 'item',
          id: state.table.id,
          fileName: state.table.name,
        },
        x: {
          mode: 'inline',
          data: state.pgls.x,
        },
        y: {
          mode: 'inline',
          data: state.pgls.y,
        },
        model: {
          mode: 'inline',
          data: state.pgls.model,
        },
      },
      outputSpec: {
        summary: {
          mode: 'girder',
          parent_id: folder._id,
          parent_type: 'folder',
          name: 'summary.csv',
        },
        plot: {
          mode: 'girder',
          parent_id: folder._id,
          parent_type: 'folder',
          name: 'plot.png',
        },
      },
    }),
  ).then(({ summary, plot }) => {
    Promise.all([Vue.http.get(`item/${summary.itemId}/files`), Vue.http.get(`item/${plot.itemId}/files`)]).then(([summaryFiles, plotFiles]) => {
      Vue.http.get(`file/${summaryFiles.body[0]._id}/download`).then((content) => {
        const data = csvParse(content.bodyText);
        commit('PGLS_RESULT', { data, plotImage: `/api/v1/file/${plotFiles.body[0]._id}/download` });
      });
    });
  });
}

const store = new Vuex.Store({
  state: {
    tree: {
      name: '',
      id: null,
    },
    table: {
      name: '',
      id: null,
    },
    tableProcessing: false,
    tableColumns: [],
    tableData: [],
    treeProcessing: false,
    treeData: {},
    activeTab: 'tree',
    phylogeneticSignal: {
      column: null,
      processing: false,
      resultData: [],
      resultColumns: [],
    },
    ancestralState: {
      column: null,
      processing: false,
      resultData: [],
      resultColumns: [],
      plotImage: null,
    },
    pgls: {
      x: null,
      y: null,
      model: 'BM',
      processing: false,
      resultData: [],
      resultColumns: [],
      plotImage: null,
    },
  },

  mutations: {
    SET_TABLE(state, table) {
      state.table = table;
    },

    TABLE_REQUEST(state) {
      state.tableProcessing = true;
    },

    TABLE_DATA(state, data) {
      state.tableColumns = data.columns;
      state.tableData = data;
      if (state.tableColumns.indexOf(state.column) < 0) {
        state.column = '';
      }
      state.tableProcessing = false;
    },

    TREE_REQUEST(state) {
      state.treeProcessing = true;
    },

    TREE_DATA(state, data) {
      state.treeData = data;
      state.treeProcessing = false;
    },

    SET_TREE(state, tree) {
      state.tree = tree;
    },

    UPDATE_ACTIVE_TAB(state, { tab }) {
      state.activeTab = tab;
    },

    PHYLOGENETIC_SIGNAL_REQUEST(state) {
      state.phylogeneticSignal.processing = true;
    },

    PHYLOGENETIC_SIGNAL_RESULT(state, data) {
      state.phylogeneticSignal.resultColumns = data.columns;
      state.phylogeneticSignal.resultData = data;
      state.phylogeneticSignal.processing = false;
    },

    UPDATE_PHYLOGENETIC_SIGNAL_COLUMN(state, column) {
      state.phylogeneticSignal.column = column;
    },

    ANCESTRAL_STATE_REQUEST(state) {
      state.ancestralState.processing = true;
    },

    ANCESTRAL_STATE_RESULT(state, { data, plotImage }) {
      state.ancestralState.resultColumns = data.columns;
      state.ancestralState.resultData = data;
      state.ancestralState.plotImage = plotImage;
      state.ancestralState.processing = false;
    },

    UPDATE_ANCESTRAL_STATE_COLUMN(state, column) {
      state.ancestralState.column = column;
    },

    PGLS_REQUEST(state) {
      state.pgls.processing = true;
    },

    PGLS_RESULT(state, { data, plotImage }) {
      state.pgls.resultColumns = data.columns;
      state.pgls.resultData = data;
      state.pgls.plotImage = plotImage;
      state.pgls.processing = false;
    },

    UPDATE_PGLS_X(state, column) {
      state.pgls.x = column;
    },

    UPDATE_PGLS_Y(state, column) {
      state.pgls.y = column;
    },

    UPDATE_PGLS_MODEL(state, model) {
      state.pgls.model = model;
    },
  },

  actions: {
    setTable({ state, commit }, table) {
      commit('SET_TABLE', table);
      commit('UPDATE_ACTIVE_TAB', { tab: 'table' });
      commit('TABLE_REQUEST');
      Vue.http.get(`item/${table.id}/files`).then((resp) => {
        Vue.http.get(`file/${resp.body[0]._id}/download`).then((content) => {
          const data = csvParse(content.bodyText);
          commit('TABLE_DATA', data);
        });
      });
    },

    setTree({ state, commit }, tree) {
      commit('SET_TREE', tree);
      commit('UPDATE_ACTIVE_TAB', { tab: 'tree' });
      commit('TREE_REQUEST');
      Vue.http.get(`item/${tree.id}/files`).then((resp) => {
        Vue.http.get(`file/${resp.body[0]._id}/download`).then((content) => {
          const data = parseNewick(content.bodyText);
          commit('TREE_DATA', data);
        });
      });
    },

    updatePhylogeneticSignalColumn({ state, commit }, column) {
      commit('UPDATE_PHYLOGENETIC_SIGNAL_COLUMN', column);
      if (state.table.id && state.tree.id && state.phylogeneticSignal.column) {
        runPhylogeneticSignal({ state, commit });
      }
    },

    updateAncestralStateColumn({ state, commit }, column) {
      commit('UPDATE_ANCESTRAL_STATE_COLUMN', column);
      if (state.table.id && state.tree.id && state.ancestralState.column) {
        runAncestralState({ state, commit });
      }
    },

    updatePglsX({ state, commit }, column) {
      commit('UPDATE_PGLS_X', column);
      if (state.table.id && state.tree.id && state.pgls.x && state.pgls.y) {
        runPgls({ state, commit });
      }
    },

    updatePglsY({ state, commit }, column) {
      commit('UPDATE_PGLS_Y', column);
      if (state.table.id && state.tree.id && state.pgls.x && state.pgls.y) {
        runPgls({ state, commit });
      }
    },

    updatePglsModel({ state, commit }, model) {
      commit('UPDATE_PGLS_MODEL', model);
      if (state.table.id && state.tree.id && state.pgls.x && state.pgls.y) {
        runPgls({ state, commit });
      }
    },
  },
});

new Vue({ // eslint-disable-line no-new
  el: '#app',
  store,
  template: '<App/>',
  components: { App },
});
