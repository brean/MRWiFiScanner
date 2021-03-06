import THREE from '/imports/libs/threejs/three.min';
import '/imports/libs/threejs/Detector';
import '/imports/libs/threejs/inflate.min';
import '/imports/libs/threejs/OrbitControls';
import '/imports/libs/threejs/three.module';
import '/imports/libs/threejs/TransformControls';

/**
 * three.js based Visualization module.
 */
class Visualization extends THREE.EventDispatcher {
  constructor(gui, documentId='container') {
    super();
    this.gui = gui;
    this.container = document.getElementById( documentId );
    if (this.container == null) {
      console.warn("can not find element: " + documentId);
      return;
    }

    this.raycaster = new THREE.Raycaster();

    // list of geometries
    this.geometries = [];

    // currently selected items
    this.selection = null;

    // event for object changes
    this.positionChangeEvent = {type: 'positionChange'};
    this.selectionChangeEvent = {type: 'selectionChange'};

    // setup THREE.js scene: create camera, add light ...
    this.init();

    window.addEventListener( 'resize', this.onWindowResize.bind(this), false );
    this.animate();
  }

  // main render loop
  animate() {
    requestAnimationFrame( this.animate.bind(this) );
    this.render();
  }

  // render scene, update controls (called every frame from animate)
  render() {
    if (this.transformControl) {
      this.transformControl.update();
    }
    if (!this.renderer || !this.scene || !this.camera) {
      return;
    }
    this.renderer.render( this.scene, this.camera );
  }

  onWindowResize() {
    if (!this.renderer || !this.scene || !this.camera) {
      console.warn("can not resize, three.js not ready");
      return;
    }
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize( window.innerWidth, window.innerHeight );
  }

  init() {
    this.initCamera();
    this.initScene();
    this.initLight();
    this.initRenderer();
    this.initControls();
    this.initMove();
  }

  initCamera() {
    let container = $(this.container);
    if (!this.camera) {
      this.camera = new THREE.PerspectiveCamera(
        75, container.width() / container.height(), 0.1, 1000 );
      //this.camera.rotation.set(0, -Math.PI / 2, -Math.PI / 2);
      this.camera.position.set(0, 0, 2);
    } else {
      this.camera.aspect = container.width() / container.height();
    }
  }

  initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color( 0x000000 );
  }

  initLight() {
    this.ambientLight = new THREE.AmbientLight( 0x666666  );
    this.scene.add( this.ambientLight );

    // TODO: configure!
    this.light = new THREE.DirectionalLight( 0xdfebff, 1.3 );
    this.light.position.set( 50, 200, 100 );
    this.light.position.multiplyScalar( 1.0 );
    this.scene.add( this.light );
  }

  initRenderer() {
    this.renderer = new THREE.WebGLRenderer({ alpha: true });
    this.renderer.setPixelRatio( window.devicePixelRatio );
    this.renderer.setSize(
      $(this.container).width(),
      $(this.container).height()
    );
    this.renderer.setClearColor( 0x000000, 0 );
    this.container.appendChild( this.renderer.domElement );
  }

  initControls() {
    this.controls = new THREE.OrbitControls(
      this.camera,
      this.renderer.domElement );
    this.controls.minDistance = 10;
    this.controls.maxDistance = 500;
  }

  initMove() {
    this.moveOffset = new THREE.Vector3();
    document.addEventListener( 'mousedown', this.onDocumentMouseDown.bind(this), false );
    document.addEventListener( 'touchstart', this.onDocumentTouchStart.bind(this), false );
    document.addEventListener( 'mouseup', this.onDocumentMouseUp.bind(this), false );
    document.addEventListener( 'touchend', this.onDocumentMouseUp.bind(this), false );
  }

  onDocumentMouseUp(event) {
    if (this.selection) {
      this.controlPositionChange(true);
    } else {
      this.selectionChangeEvent.obj = null;
      this.dispatchEvent(this.selectionChangeEvent);
    }
  }

  onDocumentTouchStart( event ) {
  	event.clientX = event.touches[0].clientX;
  	event.clientY = event.touches[0].clientY;
  	this.onDocumentMouseDown( event );
  }

  pointerToCoordinates(event) {
    let pointer = new THREE.Vector2();
    pointer.x = (event.clientX / this.renderer.domElement.clientWidth ) * 2 - 1;
    pointer.y = -(event.clientY / this.renderer.domElement.clientHeight ) * 2 + 1;
    return pointer;
  }

  onDocumentMouseDown( event ) {
    let pointer = this.pointerToCoordinates(event);
    this.raycaster.setFromCamera( pointer, this.camera );
    let self = this;

    if (this.geometries && this.geometries.length > 0) {
      let intersects = this.raycaster.intersectObjects( this.geometries );
    	if ( intersects.length > 0 ) {
        this.selection = intersects[0].object;
        self.gui.clear();
        intersects.forEach(function (data) {
          self.gui.addWiFiLocation(data.object);
        })

        this.selectionChangeEvent.selection = this.selection;
        this.dispatchEvent(this.selectionChangeEvent);
    	} else if (this.selection) {
        this.selection = null
      }
    }
  }

  /**
   * position change by mouse/touch
   */
  controlPositionChange(force=false) {
    this.lastPositionUpdate = this.lastPositionUpdate || Date.now();
    if ((Date.now() - this.lastPositionUpdate > 333) || force === true) {
      let obj = this.selection;
      let vector = new THREE.Vector3();
      vector.setFromMatrixPosition( obj.matrixWorld );

      this.positionChangeEvent['position'] = [vector.x, vector.y, vector.z];
      this.positionChangeEvent['docId'] = obj.docId;
      this.dispatchEvent( this.positionChangeEvent );

      this.lastPositionUpdate = Date.now();
    }
    this.render();
  }

  updateGeomPosition(geom, doc) {
    if (!geom) {
      return;
    }
    let p = doc.position;
    if (p) {
      geom.position.set(p[0], p[1], p[2]);
    }
    let r = doc.rotation;
    if (r) {
      geom.rotation.set(r[0], r[1], r[2]);
    }
  }

  genMaterial() {
    return new THREE.MeshLambertMaterial( {
      transparent: true,
      opacity: 0.7,
      color: 0x2194ce
    } );
  }

  addBasicGeometry(docId, newDoc, geometry) {
    this.addObject(
      docId,
      newDoc,
      new THREE.Mesh( geometry, this.genMaterial() )
    );
  }

  addObject(docId, newDoc, obj) {

    obj.docId = docId;
    obj.data = newDoc;

    this.updateGeomPosition(obj, newDoc);

		this.scene.add( obj );

    this.geometries.push(obj);

    this.controls.update();
  }

  addLocation(docId, newDoc) {
    this.addBasicGeometry(
      docId,
      newDoc,
      new THREE.SphereGeometry( .1, 32, 32 ))
  }
}


export { Visualization };
