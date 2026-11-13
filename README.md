<p align="center"><img src="assets/covers/16-douyin-app.jpg" alt="仿抖音 项目封面" width="100%"></p>

<h1 align="center">仿抖音 · Douyin Clone</h1>

<p align="center">Expo SDK 57 + React Native + TypeScript，全本地素材、零网络依赖的短视频 App</p>

<p align="center">
  <a href="https://github.com/aiyangdie/douyin-app/releases/latest">下载 Android APK</a>
</p>

## 简介

一个把抖音主流程跑通的仿制 App：竖向全屏视频流、双击点赞、评论、分享、消息、个人主页，全部用本地素材，不依赖线上服务。另带一个零依赖的管理后台，用来上传、审核和管理视频。

## 功能

- **视频流**：竖向分页吸附，一次一条；单击暂停/继续、双击点赞并弹出大爱心
- **播放细节**：进度条由 `timeUpdate` 直接写 `Animated.Value`，不触发 React 重渲染；加载前用缩略图占位
- **右侧操作栏 / 评论面板 / 分享面板**：与抖音一致的层叠布局
- **其它页面**：朋友（在线好友 + 双列瀑布流）、消息（四类入口 + 未读角标）、我（渐变封面 + 三栏九宫格）
- **发布视频**：从相册选片上传到后台，走审核队列
- **管理后台**：数据概览、审核队列（A 通过 / R 驳回 / 空格播放）、视频、用户、评论、操作日志

## 技术栈

Expo SDK 57 · React Native 0.86 · TypeScript · Expo Router · zustand ｜ 后端 `node:sqlite` 零 npm 依赖 ｜ 后台为无构建步骤的原生 ES Module SPA

## 快速开始

```bash
npm install
npm run web        # 浏览器预览
npm run ios        # iOS 模拟器（需 macOS）
npm run android    # Android 模拟器 / 真机
```

管理后台（可选）：

```bash
npm run server     # http://localhost:4000，账号 admin / 密码 admin123
npm run smoke      # 43 项接口冒烟测试
```

打包 APK：

```bash
npx expo prebuild --platform android --no-install
cd android
./gradlew :app:assembleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a
# 产物：android/app/build/outputs/apk/release/app-release.apk
```

## 界面预览

| 首页 | 评论 | 个人主页 |
|---|---|---|
| ![首页](docs/screenshots/01-feed.png) | ![评论](docs/screenshots/03-comments.png) | ![我](docs/screenshots/08-profile.png) |

## 项目结构

```
src/app/         Expo Router 路由树（tabs：首页 / 朋友 / 消息 / 我）
src/components/  feed、overlays、tabs、ui
src/lib/         格式化、动画、后端客户端
server/          HTTP 服务、sqlite、鉴权、上传（零 npm 依赖）
admin/           管理后台（原生 ES Module）
assets/          8 条本地视频、头像、封面
```

## 验证

```bash
npx tsc --noEmit    # 类型检查
npx eslint .        # 代码检查
npx expo-doctor     # 依赖诊断
```

## 已知限制

发布、私信、搜索、直播为 UI 占位，点击无跳转；分享与保存只弹提示，未接系统分享面板；评论列表只渲染首页数据，头部显示的是完整总数；Web 端用于验证，首次进入可能静音，可用右上角喇叭切换。

## 许可证

仓库未附 LICENSE 文件，使用与分发请先联系作者确认。
