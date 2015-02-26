//include ng-sanitize so we can use HTML tags inside a table cell
var app = angular.module('app', ['ngTouch','ui.bootstrap','ngSanitize']);


app.controller('GridController', function($scope, $window, $http, $q, $filter) {
	
    $scope.lang = 'fr';
    
    //(optional) dictionary used to convert some values from the data to something more user-friendly
    $scope.dico = {
            pays : {
                cr : "Costa Rica",
                gp : "Guadeloupe",
                mq : "Martinique",
                hi : "Haiti",
                gy : "Guyane",
                ja : "Jamaïque"
            },
            rapport : {
                prospects_partner : "Prospects",
                comptes_partner : "Comptes",
                factures_partner : "Factures non soldées"
            }
    };
    

    $scope.lang = 'fr';

    //List of tabs. 'name' appears in the UI, 'id' is the id of the matching data set
    $scope.rapports = [
        {
            name:"Prospects",
            id:"prospects_partner"
        },{
            name:"Comptes",
            id: "comptes_partner"
        },{
            name: "Factures non soldées",
            id: "factures_partner"
        }
    ];

    //Renderers can be used to translate raw data
    $scope.renderer = {
    	find: function(key,val){
    		for(var u in $scope.renderer.def){
        			if($scope.renderer.def[u].indexOf(key) != -1){
        				val = $scope.renderer[u](val);
        				break;
        			}
        	}
        	return val;
    	},
        //defines which columns will use which renderer
    	def:{
			toEur : ["total_ttc","total_ht","part_Hightek","part_Hightek","prix_ht"],
			toLink : ["id_compte","id_facture","id_prospect"],
			toStatut : ["regle_a_Hightek?"]
    	},
        //rendering functions
    	toMois: function(m){//rendering months
    		var m = parseInt(m);
    		var mois = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
    		if(typeof mois[m-1] !== "undefined"){
    			m = mois[m-1];
    		}
    		return m;
    	},
    	todmY: function(Ymd){
    		if(Ymd.length == 10){
    			Ymd = Ymd.split("-");
    			Ymd = String(Ymd[2]+"/"+Ymd[1]+"/"+Ymd[0]);
    		}
    		return Ymd;
    	},
    	toEur: function(value){
				var def = '-';
		    	if ( isNaN(parseFloat(value)) )return value;
				var t = (parseFloat(value)-parseInt(value)) == 0 ? value : parseFloat(value).toFixed(2); //cacher les décimales inutiles
				t = value == 0 ? def : (t+' €');
				return t;
		},
    	toLink: function(id){//creates link from a variable
    			var ret = String("<a target='_blank' href='http://your.website.com/index.php?module="+id+"'>"+id+"</a>");
    			return ret;
		},
    	toStatut: function(str){//dico des statuts paiement
    			var dico = {Pending: "En attente", Paid:"Payee"};
    			if(typeof dico[str] !== "undefined"){
    				str = dico[str];
    			}
				return str;
		}
    };
    
    
    $scope.grid = {
    	combien: 0,
    	noData : false,
    	filtrat : [],//filtered data
    	totaux : [],
        different: false,//true if we're changing the data set
    	col : [],//column
    	filtres : [],
    	strict : false,
    	orderBy : "",
    	reverse : true,//orderBy ASC or DESC
    	encours : {
    			data : []
    	},
        setRapport : function(val){
            $scope.grid.encours.data = $window.data[val];//our demo data sets
            $scope.grid.different = true;
            $scope.grid.load().then(function(){
                $scope.grid.render();
            });
        },
    	setFiltre : function(nom, model){//apply filter
    		for(var j in $scope.grid.filtres){
	    		if($scope.grid.filtres[j].name == nom)
	    			$scope.grid.filtres[j].model = model;
	    	}
    		$scope.grid.filtrer(nom,model);
    	},
    	filtrer : function(field,val){
	    	if(val.length >0 && val.length <2)return false;
	    	$scope.grid.render();
    	},
    	getFiltres: function(){
    		var ret = {};
    		var f = $scope.grid.filtres;
    		for( var i in f ){
    			if(typeof f[i].model !== "undefined" && f[i].model != ""){
    				ret[ f[i].name ] = f[i].model;
    			}
    		}
    		return ret;
    	},
    	resetFiltre: function(filtre){//reset filter
    		for( var i in $scope.grid.filtres){
    			if($scope.grid.filtres[i].name == filtre){
    				$scope.grid.filtres[i].model = "";
    				$scope.grid.render();
    				return true;
    			}
    		}
    	},
    	trier: function(colonne){//sorting function
    		if(typeof colonne === "undefined")return false;
			$scope.grid.orderBy = colonne;
			$scope.grid.reverse = !$scope.grid.reverse;
			$scope.grid.render();
    	}
    };
    
    $scope.grid.render = function(){
    	$scope.grid.isLoading = false;
    	
    	var data = $scope.grid.encours.data;
    	var dataz = [];
		var totaux = {};
		var avecTotaux = false;
		var colonnes = [];
        var filtres = [];
        
        var avecSomme = ['part_Hightek','part_Hightek','total_ht', 'prix_ht','nombre_de_cartes'];
        
        $scope.grid.combien = data.length;
        
        if(data.length == 0){
        	 $scope.grid.noData = true;
        	 $scope.grid.filtres = [];
        	 return false;
        }else{
        	$scope.grid.noData = false;
        }
        
        var m = 0;
        for ( var p in data[0] ){
        	//initialize 'TOTAL' row
        	totaux[p] = 0;
        	//COLUMNS setup
        	var colType = (avecSomme.indexOf(p) != -1) ? "number":"string";
        	colonnes.push({id: p, label: p.toUpperCase().replace(/_/gi, ' '), type: colType});
        	//FILTERS setup
        	filtres[m] = {name: p, model:"", idx:m};
        	m++;
        }
	    
        //reset filters on tab change
        if($scope.grid.different == true){
        	$scope.grid.filtres = [];
        	$scope.grid.different = false;
        }
        
        //use last computed filters if no filters are set
        if($scope.grid.filtres.length ==0){
        	$scope.grid.filtres = filtres;
        }
	    
        //filter data with $filter
        var data = $filter('filter')(data, $scope.grid.getFiltres(), $scope.grid.strict);
        //then sort
        data = $filter('orderBy')(data, $scope.grid.orderBy, $scope.grid.reverse);
        
        
        //transform each ligne of the data set into an array, because angular's track by doesn't work with an object
        var dataz = data.map(function(ligne){
        	var li = [];
        	var idx = 0;
        	for (var i in ligne){
        		var val = ligne[i];
        		
        		//(optional) use parseFloat for the values used in the 'TOTALS' row
                if( avecSomme.indexOf(i) != -1 ){
        			avecTotaux = true;
        			
        			var floatVal = parseFloat(val);
        			val = !isNaN(floatVal) ? floatVal : 0;
        			//calcule ligne TOTAUX
        			totaux[i] += val;

        		}else{
        			totaux[i] = "-";
        		}
        		
        		var val = $scope.renderer.find(i,val);//send data through its renderer
        		
        		li[idx] = { v: val , idx: idx };
        		idx++;
        	}
        	return li;
        });

        //adding the 'TOTAL' row to the grid
        var ligneTotal = [];
        var k = 0;
        for(var z in totaux){
        	var value = totaux[z];
        	var f_valeur = $scope.renderer.find(z,value);
        	ligneTotal.push({v: f_valeur, idx:k});
        	k++;
        }
        
        //use 'TOTAL' row if at least one column has a total
        if(avecTotaux){
        	dataz.push(ligneTotal);
        	$scope.grid.totaux = totaux;
        }else{
        	$scope.grid.totaux = [];
        }
        
        //update scope values for columns and data
        $scope.grid.col = colonnes;
        $scope.grid.filtrat = dataz;
    };
    
    $scope.grid.load = function(){
			var deferred = $q.defer();
			
    		$scope.grid.isLoading = true;
    		
    		//AJAX REQUEST GOES HERE!

			$scope.grid.isLoading = false;
			
			deferred.resolve(true);
					
    		return deferred.promise;
    };
    
    //reload grid on window resize
    $scope.$watch(function(){
    		return $window.innerWidth;
    	}, function(value) {
    		$scope.grid.load();
    });
});