/**
 * 发布视频。
 *
 * 两条素材来源：**从相册选**（主路径）和**内置示例片段**（备选）。
 * 保留内置片段是有意的 —— Web 预览和模拟器里没有相册，示例素材让这条
 * 链路在任何一个环境下都能跑通，也方便演示。
 *
 * 上传到服务器后视频进入 `pending`，要等后台审核通过才会出现在推荐流里。
 */
import { Ionicons } from '@expo/vector-icons';
import { Asset } from 'expo-asset';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { VIDEOS } from '../data/videos';
import { API_BASE, checkHealth, uploadVideo } from '../lib/api';
import { colors, fontSize, radius, spacing } from '../theme/tokens';

const TAG_CHOICES = ['#日常', '#旅行', '#美食', '#健身', '#摄影', '#vlog', '#萌宠', '#代码人生'];

type Status = 'idle' | 'uploading' | 'done' | 'error';

/** 即将发布的素材：内置片段，或从相册选中的视频。 */
type Selection =
  | { kind: 'clip'; index: number }
  | { kind: 'gallery'; uri: string; fileName: string; mimeType: string };

/** Turns a `require()`d asset into a URI the upload can read. */
async function resolveAssetUri(moduleId: number): Promise<string> {
  const asset = Asset.fromModule(moduleId);
  await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  if (!uri) throw new Error('无法读取素材文件');
  return uri;
}

export default function PublishScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [selection, setSelection] = useState<Selection>({ kind: 'clip', index: 0 });
  const [caption, setCaption] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const [online, setOnline] = useState<boolean | null>(null);

  const clip = selection.kind === 'clip' ? VIDEOS[selection.index] : null;

  // Probe the server once so the button can explain itself before being pressed.
  useEffect(() => {
    let alive = true;
    checkHealth().then((ok) => {
      if (alive) setOnline(ok);
    });
    return () => {
      alive = false;
    };
  }, []);

  /** Re-runs the probe; the status row is tappable for exactly this. */
  const recheck = async () => {
    setOnline(null);
    setOnline(await checkHealth());
  };

  const pickFromGallery = async () => {
    setMessage('');
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setStatus('error');
        setMessage('需要相册权限才能选择视频。请在系统设置里允许后重试。');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        allowsMultipleSelection: false,
        quality: 1,
      });
      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      setSelection({
        kind: 'gallery',
        uri: asset.uri,
        fileName: asset.fileName ?? `video-${Date.now()}.mp4`,
        mimeType: asset.mimeType ?? 'video/mp4',
      });
      setStatus('idle');
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : '打开相册失败');
    }
  };

  const toggleTag = (tag: string) =>
    setTags((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag].slice(0, 5),
    );

  const submit = async () => {
    setStatus('uploading');
    setMessage('正在准备文件…');
    try {
      const payload =
        selection.kind === 'gallery'
          ? selection
          : {
              uri: await resolveAssetUri(clip!.source as number),
              fileName: `${clip!.id}.mp4`,
              mimeType: 'video/mp4',
            };

      setMessage('正在上传…');

      const result = await uploadVideo({
        uri: payload.uri,
        fileName: payload.fileName,
        mimeType: payload.mimeType,
        caption: caption.trim() || clip?.caption || '我的作品',
        tags,
      });

      setStatus('done');
      setMessage(`已提交，视频 ID ${result.id}。审核通过后才会出现在推荐流。`);
      setOnline(true);
    } catch (error) {
      setStatus('error');
      setOnline(false);
      setMessage(error instanceof Error ? error.message : '上传失败');
    }
  };

  const busy = status === 'uploading';
  // Only a live upload blocks the button. A failed health probe must not: it is
  // a hint, not the truth, and the upload itself reports the real error.
  const disabled = busy || status === 'done';

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="取消">
          <Ionicons name="close" size={26} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>发布视频</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {/* 预览 */}
        {clip ? (
          <View style={styles.preview}>
            <Image source={clip.thumbnail} style={styles.previewImage} resizeMode="cover" />
            <View style={styles.previewBadge}>
              <Text style={styles.previewBadgeText}>示例素材 · {clip.durationSeconds}s</Text>
            </View>
          </View>
        ) : (
          <View style={[styles.preview, styles.previewPicked]}>
            <Ionicons name="videocam" size={40} color={colors.textTertiary} />
            <Text style={styles.pickedName} numberOfLines={2}>
              {selection.kind === 'gallery' ? selection.fileName : ''}
            </Text>
            <View style={styles.previewBadge}>
              <Text style={styles.previewBadgeText}>来自相册</Text>
            </View>
          </View>
        )}

        {/* 主路径：相册 */}
        <Pressable onPress={pickFromGallery} style={styles.galleryButton} accessibilityRole="button">
          <Ionicons name="images-outline" size={19} color={colors.textPrimary} />
          <Text style={styles.galleryButtonText}>
            {selection.kind === 'gallery' ? '重新选择视频' : '从相册选择视频'}
          </Text>
        </Pressable>

        {/* 备选：内置示例素材。Web / 模拟器没有相册，靠它把链路跑通。 */}
        <Text style={styles.sectionLabel}>或使用内置示例素材</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.clipRow}>
          {VIDEOS.map((item, itemIndex) => {
            const active = selection.kind === 'clip' && itemIndex === selection.index;
            return (
              <Pressable
                key={item.id}
                onPress={() => {
                  setSelection({ kind: 'clip', index: itemIndex });
                  setStatus('idle');
                  setMessage('');
                }}
                style={[styles.clip, active && styles.clipActive]}
                accessibilityLabel={`素材 ${item.id}`}
              >
                <Image source={item.thumbnail} style={styles.clipImage} resizeMode="cover" />
                {active ? (
                  <View style={styles.clipCheck}>
                    <Ionicons name="checkmark" size={13} color="#000" />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>

        {/* 文案 */}
        <Text style={styles.sectionLabel}>文案</Text>
        <TextInput
          value={caption}
          onChangeText={setCaption}
          placeholder={clip?.caption ?? '说点什么…'}
          placeholderTextColor={colors.textTertiary}
          style={styles.input}
          multiline
          maxLength={300}
        />

        {/* 话题 */}
        <Text style={styles.sectionLabel}>话题（最多 5 个）</Text>
        <View style={styles.tagRow}>
          {TAG_CHOICES.map((tag) => {
            const active = tags.includes(tag);
            return (
              <Pressable
                key={tag}
                onPress={() => toggleTag(tag)}
                style={[styles.tag, active && styles.tagActive]}
              >
                <Text style={[styles.tagText, active && styles.tagTextActive]}>{tag}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* 状态 */}
        {message ? (
          <View
            style={[
              styles.notice,
              status === 'error' && styles.noticeError,
              status === 'done' && styles.noticeDone,
            ]}
          >
            <Text style={styles.noticeText}>{message}</Text>
          </View>
        ) : null}

        <Pressable onPress={recheck} style={styles.serverRow} accessibilityRole="button">
          <View style={[styles.dot, online ? styles.dotOn : styles.dotOff]} />
          <Text style={styles.serverText}>
            {online === null
              ? '正在检测服务器…'
              : online
                ? `已连接 ${API_BASE}`
                : `未连接服务器（${API_BASE}）· 点此重试`}
          </Text>
        </Pressable>

        <Pressable
          onPress={submit}
          disabled={disabled}
          style={[styles.submit, disabled && styles.submitDisabled]}
          accessibilityRole="button"
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>
              {status === 'done' ? '已提交审核' : online === false ? '服务器未连接' : '发布'}
            </Text>
          )}
        </Pressable>

        <Text style={styles.hint}>
          上传的视频会进入后台的「审核队列」，由管理员通过后才会出现在推荐流中。
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: fontSize.title, fontWeight: '700', color: colors.textPrimary },
  headerSpacer: { width: 26 },
  body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl * 2 },

  preview: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surface, marginBottom: spacing.sm },
  previewImage: { width: '100%', height: 280 },
  previewPicked: {
    height: 190,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.divider,
    borderStyle: 'dashed',
  },
  pickedName: { color: colors.textSecondary, fontSize: 13, paddingHorizontal: spacing.xl, textAlign: 'center' },
  previewBadge: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  previewBadgeText: { color: '#fff', fontSize: 11 },

  galleryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  galleryButtonText: { color: colors.textPrimary, fontSize: fontSize.body, fontWeight: '600' },

  sectionLabel: { color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: spacing.sm, marginTop: spacing.lg },
  clipRow: { gap: spacing.sm, paddingBottom: spacing.xs },
  clip: { width: 62, height: 82, borderRadius: radius.md, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },
  clipActive: { borderColor: colors.brand },
  clipImage: { width: '100%', height: '100%' },
  clipCheck: {
    position: 'absolute',
    right: 3,
    top: 3,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.brandCyan,
    alignItems: 'center',
    justifyContent: 'center',
  },

  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    color: colors.textPrimary,
    fontSize: fontSize.body,
    padding: spacing.md,
    minHeight: 84,
    textAlignVertical: 'top',
  },

  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tag: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tagActive: { borderColor: colors.brand, backgroundColor: 'rgba(254,44,85,0.16)' },
  tagText: { color: colors.textSecondary, fontSize: 13 },
  tagTextActive: { color: colors.brand, fontWeight: '600' },

  notice: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  noticeError: { backgroundColor: 'rgba(254,44,85,0.16)' },
  noticeDone: { backgroundColor: 'rgba(37,244,238,0.12)' },
  noticeText: { color: colors.textPrimary, fontSize: 13, lineHeight: 19 },

  serverRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotOn: { backgroundColor: colors.brandCyan },
  dotOff: { backgroundColor: colors.textTertiary },
  serverText: { color: colors.textTertiary, fontSize: 12, flex: 1 },

  submit: {
    marginTop: spacing.lg,
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitDisabled: { backgroundColor: colors.surfaceMuted },
  submitText: { color: '#fff', fontSize: fontSize.title, fontWeight: '700' },

  hint: { color: colors.textTertiary, fontSize: 12, lineHeight: 18, marginTop: spacing.md, textAlign: 'center' },
});
