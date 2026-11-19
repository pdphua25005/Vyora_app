import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ProfileAvatar } from '../Auth/AccountProfile';
import { forumRequest } from './forumRequest';

const commentDate = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: 'Asia/Ho_Chi_Minh',
});

function CommentItem({ comment, postId, canReply, onChange, onPublished }) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [voting, setVoting] = useState(false);
  const [error, setError] = useState('');
  const [guest, setGuest] = useState(false);
  const [failedAvatar, setFailedAvatar] = useState(false);

  async function vote(choice) {
    if (voting) return;
    setVoting(true);
    setError('');
    setGuest(false);
    try {
      const reactions = await forumRequest(`posts/${postId}/comments/${comment.id}/reaction`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reaction: comment.myReaction === choice ? null : choice }),
      });
      onChange(current => ({ ...current, ...reactions }));
    } catch (error) {
      setGuest(error.status === 401);
      setError(error.status === 401 ? 'Đăng nhập để bày tỏ cảm xúc.' : error.message);
    } finally {
      setVoting(false);
    }
  }

  return (
    <li className="forum-comment">
      <span className="forum-comment-avatar" onError={() => setFailedAvatar(true)}>
        <ProfileAvatar className="forum-avatar"
          user={{ avatar: failedAvatar ? '' : comment.avatar, username: comment.author }} />
      </span>
      <div className="forum-comment-main">
        <div className="forum-comment-bubble">
          <div className="forum-comment-byline">
            <strong>{comment.author}</strong>
            <time dateTime={comment.createdAt}>{commentDate.format(new Date(comment.createdAt))}</time>
          </div>
          <p>{comment.body}</p>
        </div>
        <div className="forum-comment-actions">
          <button type="button" aria-pressed={comment.myReaction === 'like'} disabled={voting} onClick={() => vote('like')}>
            <span aria-hidden="true">👍</span> Thích <span>{comment.likes ?? 0}</span>
          </button>
          <button type="button" aria-pressed={comment.myReaction === 'dislike'} disabled={voting} onClick={() => vote('dislike')}>
            <span aria-hidden="true">👎</span> Không thích <span>{comment.dislikes ?? 0}</span>
          </button>
          {canReply && (
            <button type="button" aria-expanded={replyOpen} aria-controls={`replies-${comment.id}`}
              onClick={() => setReplyOpen(current => !current)}>
              {replyOpen ? 'Ẩn trả lời' : 'Trả lời'}{comment.replyCount > 0 && ` (${comment.replyCount})`}
            </button>
          )}
        </div>
        {error && (
          <p className="forum-form-error" role="alert">
            {error}{' '}{guest && <Link to="/login" state={{ forumComment: postId }}>Đăng nhập</Link>}
          </p>
        )}
        {canReply && (
          <div className="forum-comment-thread" id={`replies-${comment.id}`} hidden={!replyOpen}>
            {replyOpen && <CommentList postId={postId} parentId={comment.id} onPublished={() => {
              onChange(current => ({ ...current, replyCount: (current.replyCount ?? 0) + 1 }));
              onPublished();
            }} />}
          </div>
        )}
      </div>
    </li>
  );
}

function CommentList({ postId, parentId, onPublished }) {
  const [comments, setComments] = useState([]);
  const [next, setNext] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [retry, setRetry] = useState(0);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [guest, setGuest] = useState(false);
  const [notice, setNotice] = useState('');
  const endpoint = `posts/${postId}/comments`;
  const listEndpoint = parentId ? `${endpoint}?parent=${parentId}` : endpoint;
  const label = parentId ? 'trả lời' : 'bình luận';

  useEffect(() => {
    const controller = new AbortController();
    forumRequest(listEndpoint, { signal: controller.signal }).then(result => {
      setComments(result.comments);
      setNext(result.next);
    }).catch(error => {
      if (!controller.signal.aborted) setLoadError(error.message);
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [listEndpoint, retry]);

  async function loadMore() {
    if (loadingMore || !next) return;
    setLoadingMore(true);
    setLoadError('');
    try {
      const params = new URLSearchParams({ before: next });
      if (parentId) params.set('parent', parentId);
      const result = await forumRequest(endpoint + '?' + params);
      setComments(current => [...current, ...result.comments]);
      setNext(result.next);
    } catch (error) {
      setLoadError(error.message);
    } finally {
      setLoadingMore(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    if (!body.trim() || sending) return;

    setSending(true);
    setSendError('');
    setNotice('');
    try {
      const { comment } = await forumRequest(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: body.trim(), parentId }),
      });
      setComments(current => [comment, ...current]);
      setBody('');
      setNotice(`Đã gửi ${label}.`);
      onPublished();
    } catch (error) {
      setGuest(error.status === 401);
      setSendError(error.status === 401 ? `Đăng nhập để gửi ${label}.` : error.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="forum-comments-content" aria-label={parentId ? 'Các câu trả lời' : 'Bình luận bài viết'}>
      {loading && <p className="forum-comment-status" role="status">Đang tải {label}…</p>}
      {loadError && (
        <p className="forum-comment-status" role="alert">
          {loadError}{' '}
          <button type="button" className="forum-comment-link" onClick={() => {
            if (next) {
              loadMore();
            } else {
              setLoading(true);
              setLoadError('');
              setRetry(value => value + 1);
            }
          }}>Thử lại</button>
        </p>
      )}
      {!parentId && !loading && !loadError && comments.length === 0 && <p className="forum-comment-status">Chưa có bình luận. Hãy chia sẻ ý kiến của bạn.</p>}
      {!loading && (!loadError || comments.length > 0) && (
        <form className="forum-comment-form" onSubmit={submit}>
          <textarea aria-label={`Nội dung ${label}`} placeholder={`Viết ${label} của bạn…`} rows={2} maxLength={1000}
            value={body} onChange={event => setBody(event.target.value)} disabled={sending} required />
          <div>
            {guest ? (
              <Link to="/login" className="forum-primary" state={{ forumComment: postId }}>Đăng nhập</Link>
            ) : (
              <button type="submit" className="forum-primary" disabled={!body.trim() || sending}>{sending ? 'Đang gửi…' : 'Gửi'}</button>
            )}
          </div>
          {sendError && <p className="forum-form-error" role="alert">{sendError}</p>}
        </form>
      )}
      {notice && <p className="forum-comment-notice" role="status">{notice}</p>}
      {comments.length > 0 && (
        <ul className="forum-comment-list">
          {comments.map(comment => (
            <CommentItem key={comment.id} comment={comment} postId={postId} canReply={!parentId}
              onPublished={onPublished} onChange={update => setComments(current => current.map(item =>
                item.id === comment.id ? update(item) : item))} />
          ))}
        </ul>
      )}
      {next && !loadError && (
        <button className="forum-comment-link" type="button" onClick={loadMore} disabled={loadingMore}>
          {loadingMore ? 'Đang tải…' : `Xem thêm ${label}`}
        </button>
      )}
    </section>
  );
}

export default function Comments({ postId, count, initialOpen = false, onPublished }) {
  const [open, setOpen] = useState(initialOpen);

  return (
    <div className="forum-comments">
      <button className="forum-comment-toggle" type="button" aria-expanded={open}
        aria-controls={`comments-${postId}`} onClick={() => setOpen(value => !value)}>
        <span className="forum-comment-icon" aria-hidden="true" /> {count} bình luận
      </button>
      <div id={`comments-${postId}`} hidden={!open}>
        {open && <CommentList postId={postId} onPublished={onPublished} />}
      </div>
    </div>
  );
}
