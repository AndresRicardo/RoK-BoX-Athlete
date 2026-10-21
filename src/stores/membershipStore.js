import { create } from 'zustand';
import { supabase } from '../supabase/client';

export const useMembershipStore = create((set, get) => ({
  member: null,
  membership: null,
  linkRequest: null,
  loading: false,
  error: null,
  channel: null,

  fetchMembership: async (userId) => {
    if (!userId) {
      set({ membership: null, member: null, linkRequest: null, loading: false });
      return null;
    }

    set({ loading: true, error: null });

    try {
      // 1. Buscar si el atleta está vinculado a un miembro en 'members'
      const { data: memberData, error: memberErr } = await supabase
        .from('members')
        .select('id, document_id, full_name, is_active, profile_id')
        .eq('profile_id', userId)
        .maybeSingle();

      if (memberErr) throw memberErr;

      let member = memberData || null;
      let dynamicMembership = null;
      let linkRequest = null;

      if (member) {
        // 2. Si está vinculado, consultar la vista membership_status
        const { data: statusData, error: statusErr } = await supabase
          .from('membership_status')
          .select('*')
          .eq('member_id', member.id)
          .maybeSingle();

        if (statusErr && statusErr.code !== 'PGRST116') {
          console.warn('Error fetching membership_status:', statusErr);
        }

        if (statusData) {
          const daysRemaining = statusData.days_left ?? 0;
          dynamicMembership = {
            ...statusData,
            daysRemaining,
            isOverdue: statusData.status === 'overdue',
            isExpiringSoon: statusData.status === 'expiring_soon',
            dynamicStatus: statusData.status,
          };
        }
      } else {
        // 3. Si no está vinculado, consultar si tiene una solicitud de vínculo
        const { data: reqData } = await supabase
          .from('member_link_requests')
          .select('id, document_id, status, created_at, reviewed_at, reject_reason')
          .eq('profile_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        linkRequest = reqData || null;
      }

      set({
        member,
        membership: dynamicMembership,
        linkRequest,
        loading: false,
      });

      return dynamicMembership;
    } catch (err) {
      console.error('Error fetching membership:', err);
      set({ error: err.message, loading: false });
      return null;
    }
  },

  requestLink: async (documentId) => {
    const clean = (documentId || '').trim();
    if (!clean || clean.length < 5) {
      throw new Error('Ingresa un número de cédula válido (mínimo 5 dígitos).');
    }

    const { data, error } = await supabase.rpc('request_member_link', {
      p_document: clean,
    });

    if (error) throw error;

    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData?.session?.user?.id;
    if (uid) {
      await get().fetchMembership(uid);
    }
    return data;
  },

  subscribeMembership: (userId) => {
    if (!userId) return;

    // Desuscribir canal previo si existe
    const currentChannel = get().channel;
    if (currentChannel) {
      supabase.removeChannel(currentChannel);
    }

    const channel = supabase
      .channel(`membership_realtime_${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'memberships',
        },
        () => {
          get().fetchMembership(userId);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'members',
        },
        () => {
          get().fetchMembership(userId);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'member_link_requests',
          filter: `profile_id=eq.${userId}`,
        },
        () => {
          get().fetchMembership(userId);
        }
      )
      .subscribe();

    set({ channel });
  },

  reset: () => {
    const currentChannel = get().channel;
    if (currentChannel) {
      supabase.removeChannel(currentChannel);
    }
    set({
      member: null,
      membership: null,
      linkRequest: null,
      loading: false,
      error: null,
      channel: null,
    });
  },
}));

export default useMembershipStore;
