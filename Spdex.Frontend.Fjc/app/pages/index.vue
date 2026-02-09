<script setup lang="ts">
const { status, data } = useApiHealth()
</script>

<template>
  <div class="home-page">
    <h1>Spdex - Sports Data Exchange</h1>
    <p class="subtitle">
      Sports data display &amp; analysis platform
    </p>

    <div class="status-card">
      <h3>Backend API Status</h3>
      <p v-if="status === 'pending'" class="status loading">
        Checking connection...
      </p>
      <p v-else-if="status === 'error'" class="status offline">
        API Offline - Make sure Spdex.WebApi is running
      </p>
      <p v-else class="status online">
        API Online {{ data ? `- ${data}` : '' }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.home-page {
  text-align: center;
  padding: 3rem 0;
}

h1 {
  font-size: 2.2rem;
  color: #1a1a2e;
  margin-bottom: 0.5rem;
}

.subtitle {
  font-size: 1.1rem;
  color: #666;
  margin-bottom: 3rem;
}

.status-card {
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 1.5rem;
  max-width: 400px;
  margin: 0 auto;
}

.status-card h3 {
  margin-bottom: 0.75rem;
  color: #333;
}

.status {
  font-weight: 600;
  padding: 0.5rem 1rem;
  border-radius: 4px;
}

.status.loading {
  color: #856404;
  background: #fff3cd;
}

.status.offline {
  color: #721c24;
  background: #f8d7da;
}

.status.online {
  color: #155724;
  background: #d4edda;
}
</style>
