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

function runAnalysis({ taskName, inputSpec, outputSpec, updateStatus }) {
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
                updateStatus(status.name);
                setTimeout(waitForJob, 1000);
              } else {
                updateStatus(status.name);
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
      updateStatus(status) {
        commit('PHYLOGENETIC_SIGNAL_STATUS', { status });
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
      updateStatus(status) {
        commit('ANCESTRAL_STATE_STATUS', { status });
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
      updateStatus(status) {
        commit('PGLS_STATUS', { status });
      },
    }),
  )
  .then(({ summary, plot }) =>
    Promise.all([Vue.http.get(`item/${summary.itemId}/files`), Vue.http.get(`item/${plot.itemId}/files`)]),
  )
  .then(([summaryFiles, plotFiles]) =>
    Promise.all([
      Vue.http.get(`file/${summaryFiles.body[0]._id}/download`),
      `/api/v1/file/${plotFiles.body[0]._id}/download`,
    ]),
  )
  .then(([content, plotImage]) => {
    const data = csvParse(content.bodyText);
    commit('PGLS_RESULT', { data, plotImage });
  });
}

function runPic({ state, commit }) {
  commit('PIC_REQUEST');

  const taskName = 'PIC';

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
          data: state.pic.x,
        },
        y: {
          mode: 'inline',
          data: state.pic.y,
        },
      },
      outputSpec: {
        summary: {
          mode: 'girder',
          parent_id: folder._id,
          parent_type: 'folder',
          name: 'summary.csv',
        },
        pic: {
          mode: 'girder',
          parent_id: folder._id,
          parent_type: 'folder',
          name: 'pic.csv',
        },
      },
      updateStatus(status) {
        commit('PIC_STATUS', { status });
      },
    }),
  )
  .then(({ summary, pic }) =>
    Promise.all([
      Vue.http.get(`item/${summary.itemId}/files`),
      Vue.http.get(`item/${pic.itemId}/files`),
    ]),
  )
  .then(([summaryFiles, picFiles]) =>
    Promise.all([
      Vue.http.get(`file/${summaryFiles.body[0]._id}/download`),
      Vue.http.get(`file/${picFiles.body[0]._id}/download`),
    ]),
  )
  .then(([summaryContent, picContent]) => {
    const summaryData = csvParse(summaryContent.bodyText);
    const picData = csvParse(picContent.bodyText);
    commit('PIC_RESULT', { summary: summaryData, pic: picData });
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
    treeWidth: 750,
    treeHeight: 500,
    activeTab: 'tree',
    phylogeneticSignal: {
      column: null,
      resultData: [],
      resultColumns: [],
      processing: false,
      status: null,
    },
    ancestralState: {
      column: null,
      resultData: [],
      resultColumns: [],
      plotImage: null,
      processing: false,
      status: null,
    },
    pgls: {
      x: null,
      y: null,
      model: 'BM',
      resultData: [],
      resultColumns: [],
      plotImage: null,
      processing: false,
      status: null,
    },
    pic: {
      x: null,
      y: null,
      summaryData: [],
      summaryColumns: [],
      picData: [],
      picColumns: [],
      processing: false,
      status: null,
    },
  },

  mutations: {
    RESET_ANALYSES(state) {
      state.phylogeneticSignal.column = null;
      state.phylogeneticSignal.resultData = [];
      state.phylogeneticSignal.resultColumns = [];

      state.ancestralState.column = null;
      state.ancestralState.resultData = [];
      state.ancestralState.resultColumns = [];
      state.ancestralState.plotImage = null;

      state.pgls.x = null;
      state.pgls.y = null;
      state.pgls.resultData = [];
      state.pgls.resultColumns = [];

      state.pic.x = null;
      state.pic.y = null;
      state.pic.summaryData = [];
      state.pic.summaryColumns = [];
      state.pic.picData = [];
      state.pic.picColumns = [];
    },

    SET_TABLE(state, table) {
      state.table = table;
    },

    TABLE_REQUEST(state) {
      state.tableProcessing = true;
    },

    TABLE_DATA(state, data) {
      state.tableColumns = data.columns;
      state.tableData = data;
      state.tableProcessing = false;
    },

    SET_TREE(state, tree) {
      state.tree = tree;
    },

    TREE_REQUEST(state) {
      state.treeProcessing = true;
    },

    TREE_DATA(state, data) {
      state.treeData = data;
      state.treeProcessing = false;
    },

    UPDATE_TREE_ZOOM(state, { amount }) {
      state.treeWidth *= amount;
      state.treeHeight *= amount;
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

    PHYLOGENETIC_SIGNAL_STATUS(state, { status }) {
      state.phylogeneticSignal.status = status;
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

    ANCESTRAL_STATE_STATUS(state, { status }) {
      state.ancestralState.status = status;
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

    PGLS_STATUS(state, { status }) {
      state.pgls.status = status;
    },

    PIC_REQUEST(state) {
      state.pic.processing = true;
    },

    PIC_RESULT(state, { summary, pic }) {
      state.pic.summaryColumns = summary.columns;
      state.pic.summaryData = summary;
      state.pic.picColumns = pic.columns;
      state.pic.picData = pic;
      state.pic.processing = false;
    },

    UPDATE_PIC_X(state, column) {
      state.pic.x = column;
    },

    UPDATE_PIC_Y(state, column) {
      state.pic.y = column;
    },

    PIC_STATUS(state, { status }) {
      state.pic.status = status;
    },
  },

  actions: {
    setTable({ state, commit }, table) {
      commit('SET_TABLE', table);
      commit('RESET_ANALYSES');
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
      commit('RESET_ANALYSES');
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

    updatePicX({ state, commit }, column) {
      commit('UPDATE_PIC_X', column);
      if (state.table.id && state.tree.id && state.pic.x && state.pic.y) {
        runPic({ state, commit });
      }
    },

    updatePicY({ state, commit }, column) {
      commit('UPDATE_PIC_Y', column);
      if (state.table.id && state.tree.id && state.pic.x && state.pic.y) {
        runPic({ state, commit });
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
