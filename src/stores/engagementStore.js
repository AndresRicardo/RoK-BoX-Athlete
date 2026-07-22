import { create } from 'zustand';
import { supabase } from '../supabase/client';

const useEngagementStore = create((set, get) => ({
  // { [eventId]: { count: number, likedByMe: boolean } }
  likes: {},
  // { [eventId]: number }
  commentCounts: {},
  // { [eventId]: [comment+author] } solo de tarjetas expandidas
  commentsByEvent: {},
  saving: false,
  error: null,

  // Carga likes y contadores de comentarios de una pagina de eventos.
  fetchEngagement: async (eventIds, userId) => {
    if (!eventIds?.length) return;

    const [{ data: likes, error: e1 }, { data: comments, error: e2 }] =
      await Promise.all([
        supabase.from('feed_likes').select('event_id, user_id').in('event_id', eventIds),
        supabase.from('feed_comments').select('event_id').in('event_id', eventIds),
      ]);

    if (e1 || e2) {
      set({ error: (e1 || e2).message });
      throw e1 || e2;
    }

    const likesMap = {};
    for (const id of eventIds) likesMap[id] = { count: 0, likedByMe: false };
    for (const l of likes || []) {
      if (!likesMap[l.event_id]) likesMap[l.event_id] = { count: 0, likedByMe: false };
      likesMap[l.event_id].count += 1;
      if (l.user_id === userId) likesMap[l.event_id].likedByMe = true;
    }

    const countsMap = {};
    for (const c of comments || []) {
      countsMap[c.event_id] = (countsMap[c.event_id] || 0) + 1;
    }

    set((state) => ({
      likes: { ...state.likes, ...likesMap },
      commentCounts: { ...state.commentCounts, ...countsMap },
    }));
  },

  // Optimista: actualiza UI primero, revierte si falla.
  toggleLike: async (eventId, userId) => {
    const prev = get().likes[eventId] || { count: 0, likedByMe: false };
    const next = {
      count: prev.likedByMe ? Math.max(0, prev.count - 1) : prev.count + 1,
      likedByMe: !prev.likedByMe,
    };
    set((state) => ({ likes: { ...state.likes, [eventId]: next }, error: null }));

    const query = prev.likedByMe
      ? supabase.from('feed_likes').delete().eq('event_id', eventId).eq('user_id', userId)
      : supabase.from('feed_likes').insert({ event_id: eventId, user_id: userId });

    const { error } = await query;
    if (error) {
      set((state) => ({
        likes: { ...state.likes, [eventId]: prev },
        error: error.message,
      }));
      throw error;
    }
  },

  fetchComments: async (eventId) => {
    const { data, error } = await supabase
      .from('feed_comments')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true });

    if (error) {
      set({ error: error.message });
      throw error;
    }

    const withAuthors = await get()._withAuthors(data || []);
    set((state) => ({
      commentsByEvent: { ...state.commentsByEvent, [eventId]: withAuthors },
    }));
    return withAuthors;
  },

  addComment: async (eventId, userId, body) => {
    const text = body.trim();
    if (!text) return null;
    set({ saving: true, error: null });

    const { data, error } = await supabase
      .from('feed_comments')
      .insert({ event_id: eventId, user_id: userId, body: text.slice(0, 500) })
      .select()
      .single();

    if (error) {
      set({ saving: false, error: error.message });
      throw error;
    }

    const [withAuthor] = await get()._withAuthors([data]);
    set((state) => ({
      commentsByEvent: {
        ...state.commentsByEvent,
        [eventId]: [...(state.commentsByEvent[eventId] || []), withAuthor],
      },
      commentCounts: {
        ...state.commentCounts,
        [eventId]: (state.commentCounts[eventId] || 0) + 1,
      },
      saving: false,
    }));
    return withAuthor;
  },

  deleteComment: async (commentId, eventId) => {
    set({ saving: true, error: null });

    const { error } = await supabase
      .from('feed_comments')
      .delete()
      .eq('id', commentId);

    if (error) {
      set({ saving: false, error: error.message });
      throw error;
    }

    set((state) => ({
      commentsByEvent: {
        ...state.commentsByEvent,
        [eventId]: (state.commentsByEvent[eventId] || []).filter(
          (c) => c.id !== commentId,
        ),
      },
      commentCounts: {
        ...state.commentCounts,
        [eventId]: Math.max(0, (state.commentCounts[eventId] || 1) - 1),
      },
      saving: false,
    }));
  },

  // Adjunta el perfil publico (handle, avatar, iniciales) a cada comentario.
  _withAuthors: async (rows) => {
    if (rows.length === 0) return [];

    const ids = [...new Set(rows.map((c) => c.user_id))];
    const { data: people, error } = await supabase
      .from('athlete_directory')
      .select('*')
      .in('id', ids);

    if (error) throw error;

    const byId = new Map((people || []).map((p) => [p.id, p]));
    return rows.map((c) => ({ ...c, author: byId.get(c.user_id) || null }));
  },

  reset: () => {
    set({
      likes: {},
      commentCounts: {},
      commentsByEvent: {},
      saving: false,
      error: null,
    });
  },
}));

export default useEngagementStore;
