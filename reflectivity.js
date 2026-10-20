
    // Physics constants
    const pi   = Math.PI;              // pi = 3.14
    const mh   = 1.222430998e-6;       // = 2*m_n/hbar/hbar
    let lambda = 1.0;    let k = 1.0;  // neutron wavelength (nm), wavenumber (nm-1)
    let theta  = 0.017;  let q = 1.0;  // incident angle (rad), momentum transfer (nm-1)
    let pot = {};                      // dictionary of material
    let a_V = [];      let a_t = [];   // array of potential (neV), thickness (nm)
    let a_x = [];      let a_y = [];   // array of x-, y-axis value
    let xaxis_title = "";
    // Propertiy matrix, init with unit matrix
    let m = math.matrix([[math.complex(1,0), math.complex(0,0)],
                         [math.complex(0,0), math.complex(1,0)]]);  
    // chart for reflectivity
    let myChart = null;
    // Initialize chart
    function initChart() {
      const ctx = document.getElementById('myChart').getContext('2d');
      myChart = new Chart(ctx, {    type: 'line',
        data: {                      // labels: [],
          datasets: [{  data: [],
            borderColor: '#007bff',  // backgroundColor: 'rgba(0, 123, 255, 0.1)',
            borderWidth: 2, tension: 0.3, pointRadius: 0 }] },
        options: {
          responsive: true, maintainAspectRatio: false, 
          plugins: { legend: { display: false } },
          scales: {
            x: { type: 'linear',　
                 title: { display: true, text: 'q (nm-1)', font: { size:16 } },
                 ticks: { callback: function(value, index, ticks) {
                             return Number(value).toFixed(2); } } },
            y: { title: { display: true, text: 'Reflectivity', font: { size:16 } },
                 ticks: { callback: function(value, index, ticks) {
                             if (value === 0) return '0';
                             const currentType = this.chart.options.scales.y.type;
                             if (currentType === 'logarithmic') {
                               return Number(value).toExponential(1);
                             } else { return value; } } } }
          } } });
    }
    // Initialize chart canvas when loaded
    window.addEventListener('DOMContentLoaded', () => {  initChart();  });
    //
    // Read list of optical potential for material
    function readPotential() {
      pot = {};                      // clear dictionary and read from textarea
      const textareaValue = document.getElementById('potentialData').value;
      const lines = textareaValue.trim().split(/\r?\n/);
      lines.forEach(line => {
        if (!line.trim()) return;
        const [key, val] = line.trim().split(/\s+/);
        pot[key] = parseFloat(val);
      });
    }
    // Read list of multilayer with potential and thickness
    function readMultilayer() {
      a_V.length = [];   a_t.length = [];          // clear array and read
      const layerText = document.getElementById('multilayerData').value;
      const lines = layerText.split('\n');         // split lines
      for (let line of lines) {                    // loop for lines
        const trimmedLine = line.trim();           // trim
        if (trimmedLine === '') continue;          // skip blank lines
        const columns = trimmedLine.split(/[\s,]+/);  // split to column
        if (columns.length >= 2) {                 // add data 
          a_V.push(Number(pot[columns[0]]));       // potential (neV)
          a_t.push(Number(columns[1]));            // thickness (nm)
        }
      }
    }
    // Calculate reflectivity by property matrix method
    function makeReflectivity() {
      let mj = math.zeros(2, 2);                   // matrix for j-th layer
      let nj,nd,kj;
      let k = math.complex( 2*pi/lambda, 0);       // nm-1
      let kx = math.complex( k*math.sin(theta), 0);  // nm-1
      let lx = lambda/math.sin(theta);             // nm
      let tb = math.complex(1.,0.);                // for transparency
      m = math.matrix([[math.complex(1, 0), math.complex(0, 0)],
                         [math.complex(0, 0), math.complex(1, 0)]]);
      for (let i = 0; i < a_V.length; i++) {
        nj = math.sqrt(1. - mh*a_V[i]*lx*lx);      // refractive index
        alpha = math.multiply(nj, math.multiply(kx, a_t[i]));
        if (math.im(alpha) <= 0.) {
          const ia = math.subtract(0., math.multiply(2, math.multiply(math.i, alpha)));
          const expia = math.exp(ia);
          mj.set([0,0], math.divide( math.add(1., expia), 2.));
          mj.set([0,1], math.divide( math.subtract(1., expia), 
                        math.multiply(math.multiply(2., math.i), nj)));
          mj.set([1,0], math.subtract(0., math.divide(math.multiply(nj,
                        math.subtract(1., expia)), math.multiply(2, math.i))));
          mj.set([1,1], mj.get([0,0]));
          tb = tb*math.exp( math.multiply(math.i, alpha) );
        } else {
          const ia = math.multiply(2, math.multiply(math.i, alpha));
          const expia = math.exp(ia);
          mj.set([0,0], math.divide( math.add(1., expia), 2.));
          mj.set([0,1], math.divide( math.subtract(expia, 1.), 
                        math.multiply(math.multiply(2., math.i), nj)));
          mj.set([1,0], math.subtract(0., math.divide(math.multiply(nj,
                        math.subtract(expia, 1.)), math.multiply(2, math.i))));
          mj.set([1,1], mj.get([0,0]));
          tb = tb*math.exp( math.multiply(math.i, alpha) );
        }
        m = math.multiply(mj, m);
      }      
      // Reflectivity
      const rd = math.add( math.add(m.get([0,1]),m.get([1,0])), 
                 math.multiply( math.subtract(m.get([1,1]),m.get([0,0])), math.i));
      const rm = math.add( math.subtract(m.get([0,1]),m.get([1,0])), 
                 math.multiply( math.add(m.get([1,1]),m.get([0,0])), math.i));
      const amp = math.abs(math.divide(rd,rm));
      const ref = amp*amp;
      return ref;
    }
    
    // q-scan
    function scanQ() {
      const qMinText = document.getElementById('q_min').value;
      const qMin = Number(qMinText);               // q_min (nm-1)
      const qMaxText = document.getElementById('q_max').value;
      const qMax = Number(qMaxText);               // q_max (nm-1)
      const qD = (qMax - qMin)/500.;               // q_step
      let qScan = qMin;
      a_x = [];  a_y = [];                         // clear results
      theta = pi/180.;                             // fixed incident angle (1 deg)
      sintheta4 = 4*pi*math.sin(theta);            // = 4pi sin(theta)
      while (qScan <= qMax) {
          lambda = sintheta4/qScan;                // set lambda
          r = makeReflectivity();                  // calculation
          a_x.push(qScan);                         // xaxis = q (nm-1)
          a_y.push(r);                             // yaxis = reflectivity
          qScan = qScan + qD;
      }
      document.getElementById('resultTitle').textContent = "Result : q (nm-1) - reflectivity";
      xaxis_title = "q (nm-1)";
      outputResult();                              // output
    }
    // theta-scan
    function scanTheta() {
      const wavelengthText = document.getElementById('theta_lambda').value;
      lambda = Number(wavelengthText.trim());      // incident wavelength (nm)
      const thetaMinText = document.getElementById('theta_min').value;
      const thetaMin = Number(thetaMinText);       // angle_min (deg)
      const thetaMaxText = document.getElementById('theta_max').value;
      const thetaMax = Number(thetaMaxText);       // angle_man (deg)
      const thetaD = (thetaMax - thetaMin)/500.;   // theta_step
      let thetaScan = thetaMin;
      a_x = [];  a_y = [];                         // clear results
      while (thetaScan <= thetaMax) {
          theta = thetaScan*pi/180.;               // deg -> rad
          r = makeReflectivity();                  // calculation
          a_x.push(thetaScan);                     // xaxis = incident angle (deg)
          a_y.push(r);                             // yaxis = reflectivity
          thetaScan = thetaScan + thetaD;
      }
      document.getElementById('resultTitle').textContent = "Result : theta (deg) - reflectivity";
      xaxis_title = "incident angle (deg)";
      outputResult();                              // output
    }
    // lambda-scan
    function scanLambda() {
      const degText = document.getElementById('lambda_deg').value;
      theta = Number(degText.trim())*pi/180.;      // incident angle (rad)
      const lambdaMinText = document.getElementById('lambda_min').value;
      const lambdaMin = Number(lambdaMinText);     // lambda_min (nm)
      const lambdaMaxText = document.getElementById('lambda_max').value;
      const lambdaMax = Number(lambdaMaxText);     // lambda_max (nm)
      const lambdaD = (lambdaMax - lambdaMin)/500.;   // lambda_step
      lambda = lambdaMin;
      a_x = [];  a_y = [];                         // clear results
      while (lambda <= lambdaMax) {
          r = makeReflectivity();                  // calculation
          a_x.push(lambda);                        // xaxis = incident angle (deg)
          a_y.push(r);                             // yaxis = reflectivity
          lambda = lambda + lambdaD;
      }
      document.getElementById('resultTitle').textContent = "Result : lambda (nm) - reflectivity";
      xaxis_title = "wavelength (nm)";
      outputResult();                              // output
    }
    // output result text into textarea
    function outputResult() {
      let outputText = "";
      for (let i = 0; i < a_y.length; i++) {
        outputText = outputText + a_x[i].toFixed(4) +"\t"+a_y[i].toFixed(6)+"\n";
      }
      document.getElementById('resultData').textContent = outputText;
    }
    // update plot on chart canvas with new array
    function updateGraph(xArray, yArray) {
      if (!myChart) return;
      myChart.data.labels = xArray;                // set xaxis data
      myChart.data.datasets[0].data = yArray;      // set yaxis data
      myChart.options.scales.x.title.text = xaxis_title;  // set xaxis title
      myChart.update('none');                      // update
    }
    // calculate button click event
    function calc() {
      readPotential()                              // read potential of material
      readMultilayer();                            // read multilayer
      const selectedXaxis = document.querySelector('input[name="xaxis"]:checked');
      const selectedValue = selectedXaxis.value;   // get scan type
      if (selectedValue == "q") {
        scanQ();                                   // q-scan
      } else if (selectedValue == "angle") {
        scanTheta();                               // theta-scan
      } else if (selectedValue == "wavelength")  {
        scanLambda();                              // lambda-scan
      }
      updateGraph(a_x, a_y);                       // update plot
    }

    // Set event listener of the button
    // Calculate button
    document.getElementById('calcRefButton').addEventListener('click', calc);
    // Switch Linear <-> Log for Y axis
    document.getElementById('logyToggle').addEventListener('change', (event) => {
      if (!myChart) return;
      const newType = event.target.checked ? 'logarithmic' : 'linear';
      myChart.options.scales.y.type = newType;
      myChart.update('none'); });
    // Switch Linear <-> Log for X axis
    document.getElementById('logxToggle').addEventListener('change', (event) => {
      if (!myChart) return;
      const newType = event.target.checked ? 'logarithmic' : 'linear';
      myChart.options.scales.x.type = newType;
      myChart.update('none'); });
