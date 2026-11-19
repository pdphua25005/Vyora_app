import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import ShopHeader from '../Home/ShopHeader';
import { authRequest } from '../../services/auth';
import Comments from './Comments';
import { forumRequest } from './forumRequest';
import './Forum.css';

const topics = ['Kinh nghiệm', 'Lịch trình', 'Hỏi đáp', 'Review'];
const icons = ['✦', '⌖', '?', '★'];
const maxFiles = 5;
const maxFileBytes = 5 * 1024 * 1024;
const imageTypes = ['image/jpeg', 'image/png', 'image/webp'];

function encodeImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Không đọc được hình ảnh đã chọn.'));
    reader.readAsDataURL(file);
  });
}

function ImagePreview({ file, onRemove }) {
  const image = useRef(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    image.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className="forum-image-preview">
      <img ref={image} alt={file.name} />
      <button type="button" onClick={onRemove} aria-label={'Bỏ ảnh ' + file.name}>×</button>
    </div>
  );
}

function Composer({ busy, setBusy, onClose, onPublished, onLoginRequired }) {
  const [files, setFiles] = useState([]);
  const [error, setError] = useState('');

  function chooseImages(event) {
    const selected = Array.from(event.target.files);
    event.target.value = '';
    setError('');
    if (files.length + selected.length > maxFiles) {
      setError('Bạn chỉ có thể chọn tối đa 5 ảnh.');
      return;
    }
    if (selected.some(file => file.size > maxFileBytes)) {
      setError('Mỗi ảnh phải có dung lượng không quá 5 MB.');
      return;
    }
    if (selected.some(file => !imageTypes.includes(file.type))) {
      setError('Hãy chọn ảnh JPG, PNG hoặc WebP.');
      return;
    }
    setFiles([...files, ...selected]);
  }

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const fields = new FormData(event.currentTarget);
    const title = fields.get('title').trim();
    const body = fields.get('body').trim();
    setError('');
    if (!title || !body) {
      setError('Hãy nhập tiêu đề và nội dung bài viết.');
      return;
    }

    setBusy(true);
    try {
      const images = await Promise.all(files.map(encodeImage));
      const { post } = await forumRequest('posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body, category: fields.get('category'), images }),
      });
      onPublished(post);
    } catch (error) {
      if (error.status === 401) onLoginRequired();
      else setError(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="forum-composer" onSubmit={submit}>
      <header>
        <h2 id="forum-compose-title">Tạo bài viết</h2>
        <button type="button" className="forum-close" aria-label="Đóng trình đăng bài" onClick={onClose} disabled={busy}>×</button>
      </header>
      <fieldset disabled={busy}>
        <label>Chủ đề
          <select name="category" defaultValue="" required>
            <option value="" disabled>Chọn chủ đề cho bài viết</option>
            {topics.map(topic => <option key={topic}>{topic}</option>)}
          </select>
        </label>
        <label>Tiêu đề<input name="title" placeholder="Chuyến đi của bạn có gì thú vị?" maxLength={120} required /></label>
        <label>Nội dung<textarea name="body" placeholder="Chia sẻ câu chuyện, kinh nghiệm hoặc câu hỏi của bạn…" rows={5} maxLength={5000} required /></label>
        <div className="forum-attachments">
          <div><strong>Hình ảnh</strong><p>Tối đa 5 ảnh · 5 MB mỗi ảnh</p></div>
          <span>{files.length}/5 ảnh</span>
        </div>
        <div className="forum-preview-grid">
          {files.map((file, index) => (
            <ImagePreview key={index + ':' + file.name} file={file}
              onRemove={() => setFiles(files.filter((_, itemIndex) => itemIndex !== index))} />
          ))}
          {files.length < maxFiles && (
            <label className="forum-add-image">
              <input type="file" aria-label="Thêm ảnh" multiple accept="image/jpeg,image/png,image/webp" onChange={chooseImages} />
              <span aria-hidden="true">＋</span> Thêm ảnh
            </label>
          )}
        </div>
      </fieldset>
      {error && <p className="forum-form-error" role="alert">{error}</p>}
      <footer>
        <button type="button" className="forum-secondary" onClick={onClose} disabled={busy}>Hủy</button>
        <button type="submit" className="forum-primary" disabled={busy}>{busy ? 'Đang đăng…' : 'Đăng bài'}</button>
      </footer>
    </form>
  );
}

function PostCard({ post, onPhoto, openComments, onComment }) {
  const [avatarFailed, setAvatarFailed] = useState(false);
  return (
    <article className="forum-post">
      <div className="forum-post-byline">
        <span className={'forum-avatar' + (post.sample ? ' forum-avatar-vyora' : '')} aria-hidden="true">
          {post.avatar && !avatarFailed
            ? <img src={post.avatar} alt="" onError={() => setAvatarFailed(true)} />
            : post.author.charAt(0).toUpperCase()}
        </span>
        <div>
          <strong>{post.author}</strong>
          <small>{post.sample ? 'Bài mẫu' : new Date(post.createdAt).toLocaleDateString('vi-VN')}</small>
        </div>
        <span className="forum-topic-label">{post.category}</span>
      </div>
      <h2>{post.title}</h2>
      <p>{post.body}</p>
      {post.images.length > 0 && (
        <div className={'forum-post-images forum-post-images-' + post.images.length}>
          {post.images.map((src, index) => (
            <button type="button" key={src} onClick={() => onPhoto(src)}
              aria-label={`Xem ảnh ${index + 1} · ${post.title}`}>
              <img src={src} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
      <Comments postId={post.id} count={post.commentCount ?? 0} initialOpen={openComments} onPublished={onComment} />
    </article>
  );
}

export default function Forum() {
  const [params] = useSearchParams();
  const postId = params.get('post') || '';
  return <ForumPage key={postId} postId={postId} />;
}

function ForumPage({ postId }) {
  const { state } = useLocation();
  const navigate = useNavigate();
  const composeDialog = useRef(null);
  const imageDialog = useRef(null);
  const [composing, setComposing] = useState(false);
  const [checkingSession, setCheckingSession] = useState(Boolean(state?.compose));
  const [composeError, setComposeError] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [category, setCategory] = useState('');
  const [posts, setPosts] = useState([]);
  const [next, setNext] = useState(null);
  const [loading, setLoading] = useState(true);
  const [moreBusy, setMoreBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const composeIntent = state?.compose === true;
  useEffect(() => {
    if (!checkingSession) return;
    let active = true;

    async function checkSession() {
      try {
        await authRequest('me');
        if (!active) return;
        if (composeIntent) navigate('/forum', { replace: true });
        setComposing(true);
      } catch (error) {
        if (!active) return;
        if (error.status === 401) {
          navigate('/login', { replace: composeIntent, state: { forum: true } });
        } else {
          if (composeIntent) navigate('/forum', { replace: true });
          setComposeError(error.message);
        }
      } finally {
        if (active) setCheckingSession(false);
      }
    }

    checkSession();
    return () => { active = false; };
  }, [checkingSession, composeIntent, navigate]);

  useEffect(() => {
    if (composing && !composeDialog.current.open) composeDialog.current.showModal();
  }, [composing]);

  useEffect(() => {
    const controller = new AbortController();
    const query = category ? '?' + new URLSearchParams({ category }) : '';
    const endpoint = postId ? 'posts/' + encodeURIComponent(postId) : 'posts' + query;
    forumRequest(endpoint, { signal: controller.signal }).then(result => {
      if (controller.signal.aborted) return;
      setPosts(postId ? [result.post] : result.posts);
      setNext(result.next ?? null);
    }).catch(error => {
      if (!controller.signal.aborted) setError(error.message);
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [category, postId, retry]);

  async function loadMore() {
    const query = new URLSearchParams({ before: next });
    if (category) query.set('category', category);
    setMoreBusy(true);
    setError('');
    try {
      const result = await forumRequest('posts?' + query);
      setPosts(current => [...current, ...result.posts]);
      setNext(result.next);
    } catch (error) {
      setError(error.message);
    } finally {
      setMoreBusy(false);
    }
  }

  function selectCategory(topic) {
    if (topic === category) return;
    setLoading(true);
    setError('');
    setNext(null);
    setCategory(topic);
  }

  function refreshPosts() {
    setLoading(true);
    setError('');
    setNext(null);
    setRetry(value => value + 1);
  }

  function openComposer() {
    setComposeError('');
    setCheckingSession(true);
  }

  function publish(post) {
    composeDialog.current.close();
    setPosts(current => [post, ...current.filter(item => item.id !== post.id)]);
    setCategory('');
    refreshPosts();
    setNotice('Bài viết đã được đăng.');
  }

  function showPhoto(src) {
    setPhoto(src);
    imageDialog.current.showModal();
  }

  return (
    <div className="vyora-forum">
      <ShopHeader />
      <main className="forum-main">
        {!postId && <section className="forum-hero" aria-labelledby="forum-title">
          <div>
            <h1 id="forum-title">Diễn đàn Vyora</h1>
            <p>Chia sẻ chuyến đi, hỏi kinh nghiệm và tìm cảm hứng cho hành trình tiếp theo.</p>
            <button className="forum-primary" type="button" onClick={openComposer} disabled={moreBusy || checkingSession}>
              <span aria-hidden="true">＋</span> Tạo bài viết
            </button>
          </div>
        </section>}

        <div className="forum-layout">
          <section className="forum-feed" aria-labelledby="forum-feed-title">
            <div className="forum-feed-title">
              <h2 id="forum-feed-title">{postId ? 'Chi tiết bài viết' : 'Bài viết cộng đồng'}</h2>
              {postId ? <Link className="forum-secondary" to="/forum">Tất cả bài viết</Link>
                : <button className="forum-plus" type="button" aria-label="Thêm bài viết" onClick={openComposer} disabled={moreBusy || checkingSession}>+</button>}
            </div>
            {!postId && <div className="forum-filters" role="group" aria-label="Lọc theo chủ đề">
              {['', ...topics].map(topic => (
                <button type="button" key={topic} aria-pressed={category === topic} disabled={moreBusy}
                  onClick={() => selectCategory(topic)}>{topic || 'Tất cả'}</button>
              ))}
            </div>}
            {notice && <p className="forum-notice" role="status">{notice}</p>}
            {checkingSession && <p className="forum-state" role="status">Đang kiểm tra đăng nhập…</p>}
            {composeError && <p className="forum-state" role="alert">{composeError}</p>}
            {loading && <p className="forum-state" role="status">Đang tải bài viết…</p>}
            {error && <div className="forum-state" role="alert">{error} <button type="button" onClick={refreshPosts}>Thử lại</button></div>}
            {!loading && posts.map(post => (
              <PostCard key={post.id} post={post} onPhoto={showPhoto} openComments={state?.commentPost === post.id}
                onComment={() => setPosts(current => current.map(item => item.id === post.id
                  ? { ...item, commentCount: (item.commentCount ?? 0) + 1 }
                  : item))} />
            ))}
            {!loading && next && <button className="forum-secondary forum-more" type="button" onClick={loadMore} disabled={moreBusy}>{moreBusy ? 'Đang tải…' : 'Xem thêm bài viết'}</button>}
            {!loading && !error && !posts.length && <p className="forum-state">Chưa có bài viết về chủ đề này.</p>}
          </section>

          <aside className="forum-sidebar">
            {!postId && <section className="forum-side-card">
              <h2>Chủ đề du lịch</h2>
              {topics.map((topic, index) => (
                <button type="button" key={topic} aria-pressed={category === topic} disabled={moreBusy}
                  onClick={() => selectCategory(category === topic ? '' : topic)}>
                  <span aria-hidden="true">{icons[index]}</span><strong>{topic}</strong><span aria-hidden="true">›</span>
                </button>
              ))}
            </section>}
            <Link className="forum-side-destination" to="/products/pho-co-hoi-an">
              <img src="/assets/vyora/59f5b6b56f2c3263.png" alt="" loading="lazy" />
              <span>Khám phá phố cổ Hội An <span aria-hidden="true">→</span></span>
            </Link>
          </aside>
        </div>
      </main>

      <dialog className="forum-compose-dialog" ref={composeDialog} aria-labelledby="forum-compose-title"
        onCancel={event => { if (publishing) event.preventDefault(); }} onClose={() => setComposing(false)}>
        {composing && <Composer busy={publishing} setBusy={setPublishing} onClose={() => composeDialog.current.close()} onPublished={publish}
          onLoginRequired={() => navigate('/login', { state: { forum: true } })} />}
      </dialog>
      <dialog className="forum-photo-dialog" ref={imageDialog} aria-label="Ảnh bài viết" onClose={() => setPhoto(null)}>
        <button type="button" className="forum-close" onClick={() => imageDialog.current.close()} aria-label="Đóng ảnh">×</button>
        {photo && <img src={photo} alt="Ảnh bài viết" />}
      </dialog>
    </div>
  );
}
