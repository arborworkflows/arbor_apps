<template>
  <md-table>
    <md-table-header>
      <md-table-row>
        <md-table-head v-for="column in columns" :key="column">{{ column }}</md-table-head>
      </md-table-row>
    </md-table-header>

    <md-table-body>
      <md-table-row v-for="(row, index) in data" :key="index">
        <md-table-cell v-for="column in columns" :key="column">{{ row[column] }}</md-table-cell>
      </md-table-row>
    </md-table-body>
  </md-table>
</template>

<script>
export default {
  props: ['data', 'columns'],
};
</script>
