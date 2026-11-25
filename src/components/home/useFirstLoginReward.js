import { useEffect } from 'react';
import { User } from '@/entities/User';
import { getLevelFromXP, getNextLevelXP, XP_EVENTS } from '@/hooks/useGamification';

const inFlight = new Set();

async function award(ownerId, marker) {
  if (inFlight.has(ownerId)) return;
  inFlight.add(ownerId);
  try {
    if (localStorage.getItem(marker)) return;
    const account = await User.me();
    if (account.id !== ownerId) return;

    const previousXP = Number(account.xp) || 0;
    const amount = XP_EVENTS.first_login;
    // The old browser marker had no owner. Existing accounts with enough XP
    // may already have received the reward, so retain it for them.
    if (!localStorage.getItem('first_login_awarded') || previousXP < amount) {
      const xp = previousXP + amount;
      const level = getLevelFromXP(xp) || 1;
      await User.updateMyUserData({ xp, level, next_level_xp: getNextLevelXP(level) });
    }
    localStorage.setItem(marker, 'true');
  } catch {
    // Leave the attempt eligible the next time the family opens Home.
  } finally {
    inFlight.delete(ownerId);
  }
}

export function useFirstLoginReward(ownerId) {
  useEffect(() => {
    if (!ownerId) return;
    const marker = `first_login_awarded_${ownerId}`;
    const grant = () => award(ownerId, marker);
    if (navigator.locks) {
      void navigator.locks.request(marker, grant).catch(() => {});
    } else {
      void grant();
    }
  }, [ownerId]);
}
