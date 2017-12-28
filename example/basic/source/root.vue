<template>
  <div>
    <h1>Logux-vuex example</h1>

    <p>Counter: {{ count }}</p>

    <button @click="increment">increment</button>
  </div>
</template>

<script>
  export default {
    name: 'root',

    computed: {
      count() {
        return this.$store.state.count;
      }
    },

    methods: {
      increment() {
        this.$store.commit.sync({
          type: 'increment',
        }, { reasons: ['lastName'] });
      }
    }
  }
</script>

