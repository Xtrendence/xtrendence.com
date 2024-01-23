import React, {
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { mainColors } from '../../assets/colors/mainColors';
import { Dispatch, SetStateAction } from 'react';
import CloseIcon from '../../assets/svg/CloseIcon';
import Glass from '../core/Glass';
import { useChat } from '../../hooks/useChat';
import { useAuth } from '../../hooks/useAuth';

const statusBarHeight = StatusBar?.currentHeight ? StatusBar.currentHeight : 0;

const iconTop =
  statusBarHeight > 64 ? statusBarHeight + 8 : statusBarHeight + 24;

const menuTop = iconTop + 48 + 8;

const style = StyleSheet.create({
  background: {
    position: 'absolute',
    zIndex: 3,
    top: 0,
    left: 0,
    height: '100%',
    width: '100%',
    opacity: 0.8,
  },
  blur: {
    position: 'absolute',
    zIndex: 2,
    top: 0,
    left: 0,
    height: '100%',
    width: '100%',
    backgroundColor: mainColors.accentTransparent,
    opacity: 0.9,
  },
  menu: {
    position: 'absolute',
    display: 'flex',
    zIndex: 4,
    top: menuTop,
    right: 48 + 48 + 48 - 2,
    backgroundColor: mainColors.glassOverlay,
    borderRadius: 8,
    padding: 8,
    flexDirection: 'column',
    rowGap: 8,
  },
  menuItem: {
    display: 'flex',
    padding: 10,
    width: '100%',
    backgroundColor: mainColors.glass,
    justifyContent: 'flex-end',
    borderRadius: 8,
  },
  menuItemText: {
    color: mainColors.accentContrast,
    textAlign: 'right',
    fontWeight: 'bold',
  },
  iconWrapper: {
    position: 'absolute',
    zIndex: 4,
    top: iconTop,
    right: 48 + 48 + 48 - 2,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: mainColors.glass,
  },
  icon: {
    width: 32,
    height: 32,
  },
});

export default function Menu({
  setShowMore,
  customItems,
}: {
  setShowMore?: Dispatch<SetStateAction<boolean>>;
  customItems?: Array<{ text: string; onPress: () => void }>;
}) {
  const chat = useChat();
  const auth = useAuth();

  return (
    <>
      <TouchableOpacity
        onPress={() => {
          if (setShowMore) {
            setShowMore(false);
          }
        }}
        style={style.background}>
        <Glass wrapperStyle={style.blur} />
      </TouchableOpacity>
      <TouchableOpacity
        style={style.iconWrapper}
        onPress={() => {
          if (setShowMore) {
            setShowMore(false);
          }
        }}>
        <CloseIcon fill={mainColors.accentContrast} style={style.icon} />
      </TouchableOpacity>
      <View style={style.menu}>
        {customItems?.map(item => {
          return (
            <TouchableOpacity
              key={item.text}
              onPress={() => {
                if (item.onPress) {
                  item.onPress();
                }

                if (setShowMore) {
                  setShowMore(false);
                }
              }}
              style={style.menuItem}>
              <Text style={style.menuItemText}>{item?.text}</Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          onPress={() => {
            chat.sendMessage('/clear');

            if (setShowMore) {
              setShowMore(false);
            }
          }}
          style={style.menuItem}>
          <Text style={style.menuItemText}>Clear Chat History</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            auth.logout();

            if (setShowMore) {
              setShowMore(false);
            }
          }}
          style={style.menuItem}>
          <Text style={style.menuItemText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}
