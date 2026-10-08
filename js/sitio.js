// Cabecera: transparente sobre la portada, sólida al bajar.
(function(){
  var nav=document.getElementById('nav');
  if(nav&&nav.classList.contains('nav--over')){
    var f=function(){nav.classList.toggle('is-scrolled',window.scrollY>window.innerHeight-80)};
    f();window.addEventListener('scroll',f,{passive:true});window.addEventListener('resize',f);
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
