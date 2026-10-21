export function initHero(){
  const image=document.querySelector('#hero-image');if(!image)return;
  const slides=[
    {image:'/assets/vietnam-fine-arts-museum.jpg',alt:'Phòng trưng bày tượng gỗ và tranh dân gian tại Bảo tàng Mỹ thuật Việt Nam, Hà Nội',badge:'Không gian nghệ thuật số',title:'Khơi nguồn cảm hứng<br>từ những <em>góc nhìn mới.</em>',description:'Bước vào thế giới của sắc màu, hình khối và những câu chuyện. Một tác phẩm, một kết nối của riêng bạn.',link:'/bo-suu-tap/',cta:'Khám phá bộ sưu tập',credit:'Bảo tàng Mỹ thuật Việt Nam, Hà Nội · Daderot / CC0 ↗',source:'https://commons.wikimedia.org/wiki/File:Interior_view_-_Vietnam_National_Museum_of_Fine_Arts_-_Hanoi,_Vietnam_-_DSC05276.JPG',position:'44% 55%'},
    {image:'/assets/37557.jpg',alt:'Bình hoa điểu gốm men lam Việt Nam — The Met Open Access',badge:'Chủ đề / Sắc lam',title:'Theo một nét vẽ.<br>Chạm một <em>miền ký ức.</em>',description:'Chim, hoa và những khoảng đậm nhạt. Để sắc lam trên gốm Việt dẫn bạn qua những câu chuyện của thời gian.',link:'/bo-suu-tap/?category=blue',cta:'Khám phá sắc lam',credit:'Bình hoa điểu / The Met · Public Domain ↗',source:'https://www.metmuseum.org/art/collection/search/37557',position:'50% 32%'},
    {image:'/assets/37451.jpg',alt:'Đĩa hoa mẫu đơn Việt Nam thế kỷ XV — The Met Open Access',badge:'Câu chuyện / Một sắc men',title:'Nhìn chậm hơn.<br>Thấy nhiều <em>điều hơn.</em>',description:'Có những câu chuyện không được kể bằng lời. Chúng nằm lại trên bề mặt một chiếc đĩa, chờ bạn dừng lại.',link:'/cau-chuyen/',cta:'Đọc câu chuyện',credit:'Đĩa hoa mẫu đơn / The Met · Public Domain ↗',source:'https://www.metmuseum.org/art/collection/search/37451',position:'50% 45%'}
  ];
  const hero=image.closest('.gallery-hero'),motion=matchMedia('(prefers-reduced-motion: reduce)');
  let current=0,timer,hovered=false,inView=true,suspended=false,changing=false;
  const canPlay=()=>!motion.matches&&!document.hidden&&!hovered&&!suspended&&inView&&!hero.contains(document.activeElement);
  function schedule(){
    clearTimeout(timer);
    if(canPlay()&&!changing)timer=setTimeout(change,6000);
  }
  async function change(){
    if(!canPlay()||changing)return;
    changing=true;
    const next=(current+1)%slides.length,slide=slides[next],preview=new Image();let fade;
    try{
      preview.src=slide.image;await preview.decode();
      if(!canPlay())return;
      preview.alt='';preview.setAttribute('aria-hidden','true');preview.style.objectPosition=slide.position;
      hero.insertBefore(preview,image);
      fade=image.animate([{opacity:1},{opacity:0}],{duration:650,fill:'forwards'});
      await fade.finished;
      image.src=slide.image;image.alt=slide.alt;image.style.objectPosition=slide.position;
      document.querySelector('#hero-badge').textContent=slide.badge;document.querySelector('#home-title').innerHTML=slide.title;
      document.querySelector('#hero-description').textContent=slide.description;
      const cta=document.querySelector('#hero-cta');cta.href=slide.link;cta.innerHTML=slide.cta+' <span aria-hidden="true">↗</span>';
      current=next;
    }catch{
      // Keep the current slide if the next image cannot load.
    }finally{fade?.cancel();preview.remove();changing=false;schedule();}
  }
  hero.addEventListener('pointerenter',event=>{if(event.pointerType==='mouse'){hovered=true;schedule();}});
  hero.addEventListener('pointerleave',()=>{hovered=false;schedule();});
  hero.addEventListener('focusin',schedule);hero.addEventListener('focusout',()=>queueMicrotask(schedule));
  document.addEventListener('visibilitychange',schedule);motion.addEventListener('change',schedule);
  if('IntersectionObserver'in window)new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;schedule();}).observe(hero);
  window.addEventListener('pagehide',()=>{suspended=true;clearTimeout(timer);});
  window.addEventListener('pageshow',()=>{suspended=false;schedule();});
  schedule();
}
