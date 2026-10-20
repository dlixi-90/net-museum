// Keep old bookmarks working without a separate search page.
const query=new URLSearchParams(location.search).get('q')||'';
const params=new URLSearchParams();if(query)params.set('q',query);
location.replace('/bo-suu-tap/'+(params.size?'?'+params:''));
