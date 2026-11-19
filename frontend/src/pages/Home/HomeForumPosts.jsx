import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { forumRequest } from '../Forum/forumRequest';

function PostPreview({ post }) {
  const [avatarFailed, setAvatarFailed] = useState(false);

  return (
    <article className="home-forum-card">
      <div className="home-forum-byline">
        <span className="home-forum-avatar" aria-hidden="true">
          {post.avatar && !avatarFailed
            ? <img src={post.avatar} alt="" loading="lazy" onError={() => setAvatarFailed(true)} />
            : post.author.charAt(0).toLocaleUpperCase('vi')}
        </span>
        <div>
          <strong title={post.author}>{post.author}</strong>
          <span>{post.category}</span>
        </div>
      </div>
      <div className="home-forum-summary">
        <p className="home-forum-title" title={post.title}>{post.title}</p>
        <p className="home-forum-excerpt">{post.body}</p>
      </div>
      <div className="home-forum-card-footer">
        <span className="home-forum-count" aria-label={post.commentCount + ' bình luận'}>
          <span className="home-forum-count-icon" aria-hidden="true" />{post.commentCount}
        </span>
        <Link to={'/forum?post=' + post.id} aria-label={'Xem chi tiết bài viết ' + post.title}>
          Xem chi tiết <span aria-hidden="true">→</span>
        </Link>
      </div>
    </article>
  );
}

export default function HomeForumPosts() {
  const [posts, setPosts] = useState(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    forumRequest('posts?view=home', { signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) setPosts(data.posts);
    }).catch(() => {
      if (!controller.signal.aborted) setError(true);
    });
    return () => controller.abort();
  }, [retry]);

  return (
    <section className="home-forum-posts" aria-label="Bài viết mới từ cộng đồng">
      {error ? (
        <div className="home-forum-state" role="alert">
          Chưa tải được bài viết.
          <button type="button" onClick={() => { setError(false); setRetry(value => value + 1); }}>Thử lại</button>
        </div>
      ) : !posts ? (
        <p className="home-forum-state" role="status">Đang tải bài viết…</p>
      ) : posts.length === 0 ? (
        <p className="home-forum-state">Chưa có bài viết từ cộng đồng. <Link to="/forum" state={{ compose: true }}>Đăng bài đầu tiên</Link></p>
      ) : posts.map(post => <PostPreview key={post.id} post={post} />)}
    </section>
  );
}
