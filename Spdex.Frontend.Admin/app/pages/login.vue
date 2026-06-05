<template>
  <div class="flex h-screen items-center justify-center" style="background:#f3f4f6">
    <NCard class="w-96" title="SPdex 管理后台">
      <NForm>
        <NFormItem label="用户名">
          <NInput v-model:value="form.userName" placeholder="用户名" @keyup.enter="onLogin" />
        </NFormItem>
        <NFormItem label="密码">
          <NInput
            v-model:value="form.password"
            type="password"
            show-password-on="click"
            placeholder="密码"
            @keyup.enter="onLogin"
          />
        </NFormItem>
        <NButton type="primary" block :loading="loading" @click="onLogin">登录</NButton>
      </NForm>
    </NCard>
  </div>
</template>

<script setup lang="ts">
import { useMessage } from 'naive-ui'

definePageMeta({ layout: false })

const { login } = useAuth()
const message = useMessage()
const route = useRoute()

const loading = ref(false)
const form = reactive({ userName: '', password: '' })

async function onLogin() {
  if (!form.userName || !form.password) {
    message.warning('请输入用户名和密码')
    return
  }
  loading.value = true
  const res = await login(form.userName, form.password)
  loading.value = false
  if (res.ok) {
    await navigateTo((route.query.redirect as string) || '/')
  }
  else {
    message.error(res.message || '登录失败')
  }
}
</script>
