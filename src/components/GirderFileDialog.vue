<template>
  <div>
    <md-dialog ref="fileDialog">

      <md-toolbar class="md-transparent">
        <md-button v-if="focusedResource.parent" class="md-icon-button" @click="navigateTo(focusedResource.parent)">
          <md-icon>arrow_back</md-icon>
        </md-button>

        <h2 class="md-title" style="flex: 1">{{ focusedResource.name }}</h2>

        <md-button class="md-icon-button" @click="closeDialog()">
          <md-icon>close</md-icon>
        </md-button>
      </md-toolbar>

      <md-dialog-content class="file-dialog-content">
        <md-list class="md-dense">

          <md-list-item v-for="item in items" :key="item.id" @click="navigateTo(item)">

            <md-icon v-if="item.type === 'user'">person</md-icon>
            <md-icon v-if="item.type === 'collection'">group_work</md-icon>
            <md-icon v-if="item.type === 'folder'">folder</md-icon>
            <md-icon v-if="item.type === 'item'">description</md-icon>

            <div class="md-list-text-container">
              <span>{{ item.name }}</span>
            </div>

            <md-icon v-if="item.type !== 'item'">chevron_right</md-icon>

          </md-list-item>
        </md-list>
      </md-dialog-content>

    </md-dialog>
    <md-input-container>
      <label>{{ label }}</label>
      <md-input v-model="selectedItem.name" readonly @focus.native="openDialog()"></md-input>
    </md-input-container>
  </div>
</template>

<script>
export default {
  props: ['label'],
  data() {
    const root = {
      name: '/',
      type: 'root',
      children: [
        {
          id: 'users',
          name: 'Users',
          type: 'user',
          urls: ['user'],
        },
        {
          id: 'collections',
          name: 'Collections',
          type: 'collection',
          urls: ['collection'],
        },
      ],
    };
    root.parent = null;
    root.children.forEach((c) => { c.parent = root; });

    return {
      items: root.children,
      focusedResource: root,
      selectedItem: {
        name: '',
        id: null,
      },
    };
  },
  methods: {
    openDialog() {
      this.$refs.fileDialog.open();
    },
    closeDialog() {
      this.$refs.fileDialog.close();
    },
    navigateTo(item) {
      if (item.type === 'item') {
        this.selectedItem = {
          id: item.id,
          name: item.name,
        };
        this.$refs.fileDialog.close();
        this.$emit('change', this.selectedItem);
        return;
      }
      if (item.children) {
        this.items = item.children;
        this.focusedResource = item;
      } else {
        Promise.all(item.urls.map(url => this.$http.get(url))).then((resps) => {
          this.items = resps.map(resp =>
            resp.body.map((resource) => {
              const urls = [];
              urls.push(`folder?parentType=${resource._modelType}&parentId=${resource._id}`);
              if (resource._modelType === 'folder') {
                urls.push(`item?folderId=${resource._id}`);
              }
              return {
                id: resource._id,
                name: resource.name || resource.login,
                type: resource._modelType,
                children: null,
                urls,
                parent: item,
              };
            }),
          ).reduce((a, b) => a.concat(b), []);
          this.focusedResource = item;
        });
      }
    },
  },
};
</script>
<style scoped>
.file-dialog-content {
  min-height: 400px;
  max-height: 400px;
  min-width: 300px;
  max-width: 300px;
}
</style>
