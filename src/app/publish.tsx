/**
 * 发布视频。
 *
 * Picks from the clips bundled with the app and uploads the chosen one to the
 * backend, where it lands in the review queue. Picking from the device gallery
 * would mean adding `expo-image-picker` — a native module, which would
 * invalidate the already-published APK — so the sample clips are used instead.
 * Swapping in the gallery picker later is a one-function change:
 * replace `resolveAssetUri` with the picker's `assets[0].uri`.
 */
import { Ionicons } from '@expo/vector-icons';
import { Asset } from 'expo-asset';
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

  const [index, setIndex] = useState(0);
  const [caption, setCaption] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const [online, setOnline] = useState<boolean | null>(null);

  const clip = VIDEOS[index];

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

  const toggleTag = (tag: string) =>
    setTags((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag].slice(0, 5),
    );

  const submit = async () => {
    setStatus('uploading');
    setMessage('正在准备文件…');
    try {
      const uri = await resolveAssetUri(clip.source as number);
      setMessage('正在上传…');

      const result = await uploadVideo({
        uri,
        fileName: `${clip.id}.mp4`,
        mimeType: 'video/mp4',
        caption: caption.trim() || clip.caption,
        tags,
      });

      setStatus('done');
      setMessage(
        result.coverGenerated
          ? `已提交，视频 ID ${result.id}。审核通过后才会出现在推荐流。`
          : `已提交，视频 ID ${result.id}。服务器未安装 ffmpeg，封面将在后台显示为占位图。`,
      );
      setOnline(true);
    } catch (error) {
      setStatus('error');
      setOnline(false);
      setMessage(error instanceof Error ? error.message : '上传失败');
    }
  };

  const busy = status === 'uploading';

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
        <View style={styles.preview}>
          <Image source={clip.thumbnail} style={styles.previewImage} resizeMode="cover" />
          <View style={styles.previewBadge}>
            <Text style={styles.previewBadgeText}>
              {clip.durationSeconds}s · 720×1280
            </Text>
          </View>
        </View>

        {/* 素材选择 */}
        <Text style={styles.sectionLabel}>选择素材</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.clipRow}>
          {VIDEOS.map((item, itemIndex) => (
            <Pressable
              key={item.id}
              onPress={() => setIndex(itemIndex)}
              style={[styles.clip, itemIndex === index && styles.clipActive]}
              accessibilityLabel={`素材 ${item.id}`}
            >
              <Image source={item.thumbnail} style={styles.clipImage} resizeMode="cover" />
              {itemIndex === index ? (
                <View style={styles.clipCheck}>
                  <Ionicons name="checkmark" size={13} color="#000" />
                </View>
              ) : null}
            </Pressable>
          ))}
        </ScrollView>

        {/* 文案 */}
        <Text style={styles.sectionLabel}>文案</Text>
        <TextInput
          value={caption}
          onChangeText={setCaption}
          placeholder={clip.caption}
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
          <View style={[styles.notice, status === 'error' && styles.noticeError, status === 'done' && styles.noticeDone]}>
            <Text style={styles.noticeText}>{message}</Text>
          </View>
        ) : null}

        <View style={styles.serverRow}>
          <View style={[styles.dot, online ? styles.dotOn : styles.dotOff]} />
          <Text style={styles.serverText}>
            {online === null ? '正在检测服务器…' : online ? `已连接 ${API_BASE}` : `未连接服务器（${API_BASE}）`}
          </Text>
        </View>

        <Pressable
          onPress={submit}
          disabled={busy || online === false || status === 'done'}
          style={[styles.submit, (busy || online === false || status === 'done') && styles.submitDisabled]}
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

  preview: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surface, marginBottom: spacing.lg },
  previewImage: { width: '100%', height: 300 },
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

  sectionLabel: { color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: spacing.sm, marginTop: spacing.md },
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
