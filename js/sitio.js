// Cabecera: transparente sobre la portada, sólida al bajar.
(function(){
  var nav=document.getElementById('nav');
  if(nav&&nav.classList.contains('nav--over')){
    var f=function(){nav.classList.toggle('is-scrolled',window.scrollY>window.innerHeight-80)};
    f();window.addEventListener('scroll',f,{passive:true});window.addEventListener('resize',f);
  }
  // Menú en móvil: el botón abre y cierra la navegación a pantalla completa.
  var tg=document.getElementById('nav-toggle');
  if(nav&&tg){
    var setMenu=function(open){nav.classList.toggle('is-open',open);tg.setAttribute('aria-expanded',open);tg.textContent=open?'Cerrar':'Menú';document.documentElement.style.overflow=open?'hidden':''};
    tg.addEventListener('click',function(){setMenu(!nav.classList.contains('is-open'))});
    nav.querySelectorAll('nav a').forEach(function(a){a.addEventListener('click',function(){setMenu(false)})});
    document.addEventListener('keydown',function(ev){if(ev.key==='Escape')setMenu(false)});
  }

  // Movimiento al hacer scroll: los bloques entran al aparecer, las fotos se descubren
  // de arriba abajo y se desplazan dentro de su marco, y las dos columnas de proyectos
  // avanzan a velocidades distintas.
  var calm=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(!calm&&'IntersectionObserver' in window){
    document.documentElement.classList.add('js');
    var els=document.querySelectorAll('.pcard,.vent,.step,.svc,.svc-list li,.intro>*,.sec__head,.sec--dark h2,.cta__in>*,.proj__img,.prose p,.contact>*');
    var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}})},{rootMargin:'0px 0px -12% 0px',threshold:.05});
    els.forEach(function(el,i){
      el.setAttribute('data-reveal','');
      var sib=Array.prototype.indexOf.call(el.parentNode.children,el);
      if(!el.classList.contains('pcard'))el.style.setProperty('--d',Math.min(sib,5)*.09+'s');
      io.observe(el);
    });
    var imgs=document.querySelectorAll('.pcard__img img'),grids=document.querySelectorAll('.pgrid'),tick=false;
    var move=function(){
      tick=false;var vh=window.innerHeight,wide=window.innerWidth>560;
      imgs.forEach(function(im){var r=im.parentNode.getBoundingClientRect();
        if(r.bottom<-200||r.top>vh+200)return;
        im.style.translate='0 '+(((r.top+r.height/2)-vh/2)/vh*-7).toFixed(2)+'%'});
      grids.forEach(function(g){var r=g.getBoundingClientRect(),p=Math.max(0,Math.min(1,(vh-r.top)/(vh+r.height)));
        var c=g.children;if(c.length<2)return;
        c[0].style.transform=wide?'translateY('+(p*50).toFixed(1)+'px)':'';
        c[1].style.transform=wide?'translateY('+(-p*110).toFixed(1)+'px)':''});
    };
    var req=function(){if(!tick){tick=true;requestAnimationFrame(move)}};
    window.addEventListener('scroll',req,{passive:true});window.addEventListener('resize',req);move();
  }

  // Proyectos: el círculo "Ver proyecto" sigue al cursor dentro de cada foto.
  document.querySelectorAll('.pcard__img').forEach(function(box){
    var b=box.querySelector('.pcard__badge');if(!b)return;
    box.addEventListener('pointermove',function(ev){
      var r=box.getBoundingClientRect();
      b.style.setProperty('--x',(ev.clientX-r.left)+'px');b.style.setProperty('--y',(ev.clientY-r.top)+'px');b.style.setProperty('--s',1);
    });
    box.addEventListener('pointerleave',function(){b.style.setProperty('--s',0)});
  });
  // Formulario de contacto (versión de prueba): abre el correo del visitante con el mensaje ya escrito.
  var form=document.getElementById('form-contacto');
  if(form)form.addEventListener('submit',function(ev){
    ev.preventDefault();
    var msg=document.getElementById('form-msg'),d=new FormData(form);
    if(!form.checkValidity()){msg.textContent='Rellena tu nombre, un email válido y cuéntanos tu proyecto.';return}
    var body='Nombre: '+d.get('nombre')+'\nEmpresa: '+(d.get('empresa')||'-')+'\nEmail: '+d.get('email')+'\n\n'+d.get('mensaje');
    window.location.href='mailto:info@launchstudiogroup.com?subject='+encodeURIComponent('Nuevo proyecto — '+d.get('nombre'))+'&body='+encodeURIComponent(body);
    msg.textContent='Se ha abierto tu programa de correo con el mensaje preparado. Si no se abre, escríbenos a info@launchstudiogroup.com.';
  });
})();
