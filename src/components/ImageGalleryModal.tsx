import { useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  visible: boolean;
  uris: string[];
  initialIndex?: number;
  onClose: () => void;
};

const { width: SCREEN_W } = Dimensions.get('window');

export function ImageGalleryModal({ visible, uris, initialIndex = 0, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<string>>(null);
  const [page, setPage] = useState(initialIndex);

  useEffect(() => {
    if (visible) setPage(Math.min(initialIndex, Math.max(0, uris.length - 1)));
  }, [visible, initialIndex, uris.length]);

  if (uris.length === 0) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={[styles.backdrop, { paddingTop: insets.top }]}>
        <Pressable style={styles.closeZone} onPress={onClose}>
          <Text style={styles.closeText}>Cerrar</Text>
        </Pressable>
        <FlatList
          key={`${uris.join('|')}_${initialIndex}`}
          ref={listRef}
          data={uris}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item, i) => `${item}_${i}`}
          initialScrollIndex={Math.min(initialIndex, uris.length - 1)}
          getItemLayout={(_, index) => ({
            length: SCREEN_W,
            offset: SCREEN_W * index,
            index,
          })}
          onMomentumScrollEnd={(e) => {
            const x = e.nativeEvent.contentOffset.x;
            setPage(Math.round(x / SCREEN_W));
          }}
          renderItem={({ item }) => (
            <View style={[styles.page, { width: SCREEN_W }]}>
              <Image source={{ uri: item }} style={styles.image} resizeMode="contain" />
            </View>
          )}
        />
        {uris.length > 1 ? (
          <Text style={styles.counter}>
            {page + 1} / {uris.length}
          </Text>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#0d0d0d',
  },
  closeZone: {
    alignSelf: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  closeText: { color: '#fff', fontSize: 16 },
  page: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: SCREEN_W,
    height: '88%',
  },
  counter: {
    position: 'absolute',
    bottom: 28,
    alignSelf: 'center',
    color: '#ffffffaa',
    fontSize: 14,
  },
});
