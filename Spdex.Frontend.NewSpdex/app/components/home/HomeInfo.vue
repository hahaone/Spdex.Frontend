<script setup lang="ts">
/** 首页模块「使用提示」。 */
</script>

<template>
  <div class="info-card">
    <div class="info-head">
      <span class="dot brand" />
      <h3>使用提示</h3>
    </div>
    <ul>
      <li>指标行右侧的数字 = 当前可看赛事数</li>
      <li>上半场进球模型每 30 秒扫描，命中赛事进入"双红"指标</li>
      <li>会员等级影响推送数量与现场大单可见度</li>
    </ul>
  </div>
</template>

<style scoped>
.info-card {
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 5px;
  background: var(--panel);
}

.info-head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.info-head .dot {
  width: 4px;
  height: 14px;
  border-radius: 1px;
}

.info-head .dot.brand {
  background: var(--brand);
}

.info-head h3 {
  margin: 0;
  font-size: 0.82rem;
  font-weight: 800;
}

.info-card ul {
  display: grid;
  gap: 4px;
  margin: 0;
  padding-left: 14px;
  color: var(--muted);
  font-size: 0.78rem;
  font-weight: 720;
  line-height: 1.45;
}
</style>
