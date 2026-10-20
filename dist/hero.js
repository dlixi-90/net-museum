export function initHero(){
  const image=document.querySelector('#hero-image');if(!image)return;
  const slides=[
    {image:'/assets/gallery-interior.jpg',alt:'Phòng tranh với các tác phẩm trên tường — ảnh minh họa của Dannie Jing',badge:'Không gian nghệ thuật số',title:'Khơi nguồn cảm hứng<br>từ những <em>góc nhìn mới.</em>',description:'Bước vào thế giới của sắc màu, hình khối và những câu chuyện. Một tác phẩm, một kết nối của riêng bạn.',link:'/bo-suu-tap/',cta:'Khám phá bộ sưu tập',credit:'Ảnh minh họa: Dannie Jing / Unsplash ↗',source:'https://unsplash.com/photos/3GZlhROZIQg',position:'50% 53%'},
    {image:'/assets/37557.jpg',alt:'Bình hoa điểu gốm men lam Việt Nam — The Met Open Access',badge:'Chủ đề / Sắc lam',title:'Theo một nét vẽ.<br>Chạm một <em>miền ký ức.</em>',description:'Chim, hoa và những khoảng đậm nhạt. Để sắc lam trên gốm Việt dẫn bạn qua những câu chuyện của thời gian.',link:'/bo-suu-tap/?category=blue',cta:'Khám phá sắc lam',credit:'Bình hoa điểu / The Met · Public Domain ↗',source:'https://www.metmuseum.org/art/collection/search/37557',position:'50% 32%'},
    {image:'/assets/37451.jpg',alt:'Đĩa hoa mẫu đơn Việt Nam thế kỷ XV — The Met Open Access',badge:'Câu chuyện / Một sắc men',title:'Nhìn chậm hơn.<br>Thấy nhiều <em>điều hơn.</em>',description:'Có những câu chuyện không được kể bằng lời. Chúng nằm lại trên bề mặt một chiếc đĩa, chờ bạn dừng lại.',link:'/cau-chuyen/',cta:'Đọc câu chuyện',credit:'Đĩa hoa mẫu đơn / The Met · Public Domain ↗',source:'https://www.metmuseum.org/art/collection/search/37451',position:'50% 45%'}
  ];
  let current=0;
  function change(direction){
    current=(current+direction+slides.length)%slides.length;const slide=slides[current];
    image.src=slide.image;image.alt=slide.alt;image.style.objectPosition=slide.position;
    document.querySelector('#hero-badge').textContent=slide.badge;document.querySelector('#home-title').innerHTML=slide.title;
    document.querySelector('#hero-description').textContent=slide.description;
    const cta=document.querySelector('#hero-cta');cta.href=slide.link;cta.innerHTML=slide.cta+' <span aria-hidden="true">↗</span>';
    const credit=document.querySelector('#hero-credit');credit.href=slide.source;credit.textContent=slide.credit;
    document.querySelector('#hero-current').textContent=String(current+1).padStart(2,'0')+' / 03';
  }
  document.querySelector('#hero-prev').addEventListener('click',()=>change(-1));
  document.querySelector('#hero-next').addEventListener('click',()=>change(1));
}
